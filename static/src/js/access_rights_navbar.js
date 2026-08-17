/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Navbar } from "@point_of_sale/app/navbar/navbar";

patch(Navbar.prototype, {
    /**
     * Hide the Cash In/Out button when the cashier lacks permission.
     */
    get showCashMoveButton() {
        const base = super.showCashMoveButton;
        if (!base) {
            return false;
        }
        return this.pos._hasAccess("pos_access_cash_in_out");
    },

    /**
     * Hide the Create Product button when the cashier lacks permission.
     */
    get showCreateProductButton() {
        if (!this.pos._hasAccess("pos_access_create_product")) {
            return false;
        }
        return super.showCreateProductButton;
    },

    /**
     * Hide the backend switch when the cashier lacks permission.
     */
    get showBackend() {
        if (!this.pos._hasAccess("pos_access_backend")) {
            return false;
        }
        // pos_hr defines this getter; if it doesn't exist on super,
        // fall back to true (base POS always shows backend).
        if (typeof super.showBackend !== "undefined") {
            return super.showBackend;
        }
        return true;
    },
});
