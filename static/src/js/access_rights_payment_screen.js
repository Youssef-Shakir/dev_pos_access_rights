/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(PaymentScreen.prototype, {
    /**
     * Block payment validation when the cashier lacks permission.
     */
    async validateOrder(isForceValidate) {
        if (!this.pos._hasAccess("pos_access_payment")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to validate payments."),
            });
            return;
        }
        return super.validateOrder(isForceValidate);
    },

    /**
     * Block invoice toggle when the cashier lacks permission.
     */
    toggleIsToInvoice() {
        if (!this.pos._hasAccess("pos_access_create_invoice")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to create invoices."),
            });
            return;
        }
        return super.toggleIsToInvoice();
    },

    /**
     * Block tip entry when the cashier lacks permission.
     */
    async addTip() {
        if (!this.pos._hasAccess("pos_access_tip")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to add tips."),
            });
            return;
        }
        return super.addTip();
    },
});
