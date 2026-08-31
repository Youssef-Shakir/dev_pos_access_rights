/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { LoginScreen } from "@point_of_sale/app/screens/login_screen/login_screen";
import { _t } from "@web/core/l10n/translation";

/**
 * Restrict which employee is allowed to *open* the register from the POS
 * employee-login screen (pos_hr). This only applies while the session is
 * still in "opening_control" state, i.e. nobody has opened it yet for the
 * day: once it's open, switching cashiers during the day is normal usage
 * and is not affected by this check.
 *
 * The actual cashier selection (PIN typing, popup, badge/barcode scan) is
 * spread across a couple of entry points, so both are patched here and
 * the result is checked right after the base logic has run (rather than
 * trying to duplicate PIN verification / selection-popup logic to know
 * the employee upfront).
 */
patch(LoginScreen.prototype, {
    async selectCashier(pin = false, login = false, list = false) {
        const employee = await super.selectCashier(...arguments);
        this._enforceOpenSessionAccess(employee);
        return employee;
    },

    selectOneCashier(cashier) {
        super.selectOneCashier(cashier);
        this._enforceOpenSessionAccess(cashier);
    },

    _enforceOpenSessionAccess(employee) {
        if (
            !employee ||
            !this.pos.config.module_pos_hr ||
            this.pos.session?.state !== "opening_control" ||
            employee.pos_access_open_session !== false
        ) {
            return;
        }
        // The base flow already logged this employee in and navigated
        // away (set_cashier + showScreen) before we could know who was
        // selected — undo it and send them back to the login screen.
        this.pos.reset_cashier();
        this.pos.hasLoggedIn = false;
        this.pos.login = false;
        this.pos.showScreen("LoginScreen");
        this.pos._showAccessDenied(
            _t(
                "Session is not open. You are not allowed to open this register — please ask a manager to open it first."
            )
        );
    },
});
