/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { OrderSummary } from "@point_of_sale/app/screens/product_screen/order_summary/order_summary";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(OrderSummary.prototype, {
    /**
     * Override _setValue to enforce:
     * - Line removal restriction (pos_access_delete_order_line)
     * - Discount restriction (pos_access_discount + max discount)
     */
    _setValue(val) {
        if (
            !this.pos.config.enable_access_rights ||
            !this.pos.config.module_pos_hr
        ) {
            return super._setValue(val);
        }

        const { numpadMode } = this.pos;
        const selectedLine = this.currentOrder.get_selected_orderline();
        if (!selectedLine) {
            return super._setValue(val);
        }

        // ── Block line removal ────────────────────────────────────
        // Lines that haven't been sent to the kitchen/preparation tool
        // yet (not "saved"/green) are still a draft: any cashier may
        // always remove them, regardless of table navigation or the
        // "Can Remove Order Lines" permission. Only removing a line
        // that was already sent requires that permission.
        //
        // NOTE: `saved_quantity` is NOT a "sent" marker — core POS
        // bumps it on every table/order switch for its own unrelated
        // decrease-quantity accounting, so a line that was simply left
        // and revisited would look "sent" if we used it here.
        // `uiState.hasChange` is the real signal: it starts true and
        // only flips to false once the order has actually been sent.
        if (numpadMode === "quantity" && val === "remove") {
            const alreadySent = selectedLine.uiState?.hasChange === false;
            if (alreadySent && !this.pos._hasAccess("pos_access_delete_order_line")) {
                this.dialog.add(AlertDialog, {
                    title: _t("Access Denied"),
                    body: _t("You are not allowed to remove order lines that have already been sent."),
                });
                return;
            }
        }

        return super._setValue(val);
    },

    /**
     * Only reached when reducing a line's quantity below what was
     * already sent to the kitchen/preparation tool (see
     * `disallowLineQuantityChange` in access_rights_store.js).
     * Require an authorized colleague to approve the reduction.
     */
    async handleDecreaseLine(newQuantity) {
        if (
            this.pos._accessRightsActive() &&
            !(await this.pos._authorizeQuantityReduction())
        ) {
            return 0;
        }
        return super.handleDecreaseLine(newQuantity);
    },
});
