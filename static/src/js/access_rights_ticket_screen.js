/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(TicketScreen.prototype, {
    /**
     * Block refund when the cashier lacks permission.
     */
    async onDoRefund() {
        if (!this.pos._hasAccess("pos_access_refund")) {
            this.dialog.add(AlertDialog, {
                title: _t("Access Denied"),
                body: _t("You are not allowed to process refunds."),
            });
            return;
        }
        return super.onDoRefund();
    },

    /**
     * Hide the delete button when the cashier cannot delete orders.
     */
    shouldHideDeleteButton(order) {
        if (!this.pos._hasAccess("pos_access_delete_order")) {
            return true;
        }
        return super.shouldHideDeleteButton(order);
    },
});
