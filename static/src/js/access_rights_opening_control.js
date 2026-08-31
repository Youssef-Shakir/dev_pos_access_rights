/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { OpeningControlPopup } from "@point_of_sale/app/store/opening_control_popup/opening_control_popup";
import { _t } from "@web/core/l10n/translation";

/**
 * `OpeningControlPopup.confirm()` is the single, authoritative action
 * that actually flips the session from "opening_control" to "opened"
 * (via the pos.session.set_opening_control RPC) — regardless of how
 * the cashier got to this popup: a normal login-screen selection, a
 * cashier restored from a previous tab/reload
 * (PosStore.checkPreviousLoggedCashier reads straight from
 * sessionStorage and calls set_cashier directly, bypassing
 * LoginScreen entirely), or any timing gap around the login-screen
 * check in access_rights_login_screen.js.
 *
 * So the permission is enforced here too, as the last-mile guard,
 * instead of relying solely on catching every possible path that
 * leads here.
 */
patch(OpeningControlPopup.prototype, {
    async confirm() {
        const cashier = this.pos.get_cashier();
        if (
            this.pos.config.module_pos_hr &&
            cashier &&
            cashier.pos_access_open_session === false
        ) {
            this.pos._showAccessDenied(
                _t(
                    "Session is not open. You are not allowed to open this register — please ask a manager to open it first."
                )
            );
            this.props.close();
            this.pos.showLoginScreen();
            return;
        }
        return super.confirm();
    },
});
