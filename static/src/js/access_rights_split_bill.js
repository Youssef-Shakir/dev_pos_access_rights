/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { SplitBillScreen } from "@pos_restaurant/app/split_bill_screen/split_bill_screen";

/**
 * Split bill creates new lines (new uuids) in a new order. Tell the server
 * which source line each new line came from, so pos_preparation_direct does
 * not print the moved items again on the new order's next "send to kitchen".
 *
 * Core creates one new line per split line, in the order of the source
 * lines, so the snapshot taken before the split lines up with the new
 * order's lines afterwards.
 */
patch(SplitBillScreen.prototype, {
    async preSplitOrder(originalOrder, newOrder) {
        this._splitMoves = originalOrder.lines
            .filter((line) => this.qtyTracker[line.uuid])
            .map((line) => ({
                from: line.uuid,
                productId: line.product_id?.id,
                qty: this.qtyTracker[line.uuid],
                total: line.get_quantity(),
            }));
        return super.preSplitOrder(...arguments);
    },

    async postSplitOrder(originalOrder, newOrder) {
        const result = await super.postSplitOrder(...arguments);
        const snapshot = this._splitMoves || [];
        this._splitMoves = null;
        const newLines = newOrder.lines;
        const moves = [];
        snapshot.forEach((move, index) => {
            const newLine = newLines[index];
            if (newLine && newLine.product_id?.id === move.productId) {
                moves.push({ from: move.from, to: newLine.uuid, qty: move.qty, total: move.total });
            }
        });
        if (moves.length) {
            try {
                await this.pos.data.call("pos.order", "move_split_preparation_history", [
                    originalOrder.uuid,
                    newOrder.uuid,
                    moves,
                ]);
            } catch (error) {
                console.error("[SplitBill] Could not move the preparation history:", error);
            }
        }
        return result;
    },
});
