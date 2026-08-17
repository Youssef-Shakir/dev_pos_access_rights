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
        if (numpadMode === "quantity" && val === "remove") {
            if (!this.pos._hasAccess("pos_access_delete_order_line")) {
                this.dialog.add(AlertDialog, {
                    title: _t("Access Denied"),
                    body: _t("You are not allowed to remove order lines."),
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
