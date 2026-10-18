/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { rpc } from "@web/core/network/rpc";
import { _t } from "@web/core/l10n/translation";

/**
 * Table transfer onto a table that already has an order.
 *
 * Core (pos_restaurant `transferOrder`) copies the lines into the
 * destination order and then calls `deleteOrders([sourceOrder])`, which:
 *   - is blocked by the "delete order" access right of this module, so the
 *     source order stayed on the old table (items on both tables), and
 *   - otherwise marks the source order as cancelled on the server.
 *
 * This override keeps core's line-merging logic (copied from Odoo 18
 * pos_restaurant/static/src/overrides/models/pos_store.js) but removes the
 * source order locally and lets the server delete it via
 * `pos.order.drop_transferred_order`, once the destination order is saved.
 * Transfers to an empty table (just a table_id change) still use core.
 */
patch(PosStore.prototype, {
    /**
     * Whether another device/employee currently has `table` open (table lock).
     * Returns {inUse, by} or {error: true} when the server can't be reached.
     */
    async _getTableUseByOther(table) {
        try {
            const status = await rpc("/pos_access_rights/table/locks_status", {
                table_ids: [table.id],
            });
            const lock = status?.[table.id];
            if (!lock?.locked) {
                return { inUse: false };
            }
            const cashierId = this.get_cashier()?.id || false;
            const isMine =
                lock.lock_user_id === this.user?.id &&
                (lock.lock_employee_id || false) === cashierId;
            return { inUse: !isMine, by: lock.locked_by };
        } catch (error) {
            console.error("[TableTransfer] Could not check the destination table:", error);
            return { error: true };
        }
    },

    async transferOrder(orderUuid, destinationTable) {
        const order = this.models["pos.order"].getBy("uuid", orderUuid);

        // Never move items onto a table someone else has open (e.g. the
        // cashier taking its payment): their screen would still show the old
        // order and charge the old total.
        if (order && destinationTable && destinationTable.id !== order.table_id?.id) {
            const use = await this._getTableUseByOther(destinationTable);
            if (use.error || use.inUse) {
                this.dialog.add(AlertDialog, {
                    title: use.error ? _t("Connection problem") : _t("Table in use"),
                    body: use.error
                        ? _t("Could not check the destination table. Check the connection and try again.")
                        : _t(
                              "This table is currently open by %s. Wait until they are done, then transfer again.",
                              use.by
                          ),
                });
                return;
            }
        }

        const destinationOrder = this.getActiveOrdersOnTable(destinationTable)[0];
        if (
            !order ||
            !destinationOrder ||
            destinationOrder === order ||
            destinationTable.id === order.table_id?.id
        ) {
            return super.transferOrder(...arguments);
        }

        await this.syncAllOrders({ orders: [destinationOrder] });
        this.loadingOrderState = false;
        this.alert.dismiss();

        // source line uuid -> destination line uuid (for preparation job history)
        const lineUuidMap = {};
        for (const orphanLine of order.lines) {
            const adoptingLine = destinationOrder.lines.find((l) =>
                l.can_be_merged_with(orphanLine)
            );
            if (adoptingLine) {
                adoptingLine.merge(orphanLine);
                this.mergePreparationLines(
                    order.last_order_preparation_change.lines[orphanLine.preparationKey],
                    destinationOrder.last_order_preparation_change.lines[
                        adoptingLine.preparationKey
                    ],
                    destinationOrder,
                    adoptingLine
                );
                lineUuidMap[orphanLine.uuid] = adoptingLine.uuid;
            } else {
                const serialized = orphanLine.serialize();
                serialized.order_id = destinationOrder.id;
                delete serialized.uuid;
                delete serialized.id;
                const newOrderLine = this.models["pos.order.line"].create(
                    serialized,
                    false,
                    true
                );

                const preparationLine =
                    order.last_order_preparation_change.lines[orphanLine.preparationKey];
                if (preparationLine) {
                    const preparationLineCopy = { ...preparationLine };
                    preparationLineCopy.order_id = destinationOrder.id;
                    preparationLineCopy.uuid = newOrderLine.uuid;
                    destinationOrder.last_order_preparation_change.lines[
                        newOrderLine.preparationKey
                    ] = preparationLineCopy;
                    preparationLine.quantity = 0;
                }
                lineUuidMap[orphanLine.uuid] = newOrderLine.uuid;
            }
        }

        this.set_order(destinationOrder);

        // Remove the source order locally only. removePendingOrder drops the
        // server "delete" (= cancel) that removeOrder queues in restaurant mode.
        const sourceUuid = order.uuid;
        this.removeOrder(order, false);
        this.removePendingOrder(order);

        await this.syncAllOrders({ orders: [destinationOrder] });
        try {
            await this.data.call("pos.order", "drop_transferred_order", [
                sourceUuid,
                destinationOrder.uuid,
                lineUuidMap,
            ]);
        } catch (error) {
            console.error("[TableTransfer] Could not remove the transferred order:", error);
        }
        await this.setTable(destinationTable);
    },
});
