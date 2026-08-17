/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";

patch(ClosePosPopup.prototype, {
    /**
     * Deny session close authority when the cashier lacks permission.
     * The base pos_hr check already looks at _role and _user_role;
     * we add the per-employee field on top of that.
     */
    hasUserAuthority() {
        if (!this.pos._hasAccess("pos_access_close_session")) {
            return false;
        }
        return super.hasUserAuthority();
    },
});
