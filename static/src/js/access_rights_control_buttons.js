/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(ControlButtons.prototype, {
    /**
     * Block fiscal position change when the cashier lacks permission.
     */
    async clickFiscalPosition() {
        if (!this.pos._hasAccess("pos_access_fiscal_position")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to change the fiscal position."),
            });
            return;
        }
        return super.clickFiscalPosition();
    },

    /**
     * Block pricelist change when the cashier lacks permission.
     */
    async clickPricelist() {
        if (!this.pos._hasAccess("pos_access_pricelist")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to change the pricelist."),
            });
            return;
        }
        return super.clickPricelist();
    },

    /**
     * Block refund screen access when the cashier lacks permission.
     */
    clickRefund() {
        if (!this.pos._hasAccess("pos_access_refund")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to process refunds."),
            });
            return;
        }
        return super.clickRefund();
    },
});
