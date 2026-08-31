# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2015 DevIntelle Consulting Service Pvt.Ltd (<http://www.devintellecs.com>).
#
#    For Module Support : devintelle@gmail.com  or Skype : devintelle
#
##############################################################################


from odoo import _, fields, models
from odoo.exceptions import UserError


class PosConfig(models.Model):
    _inherit = "pos.config"

    enable_access_rights = fields.Boolean(
        string="Enable POS Access Rights",
        default=False,
        help="When enabled, per-employee access rights are enforced "
        "in the POS session.  Requires pos_hr (employee login).",
    )

    require_network_connection = fields.Boolean(
        string="Require Network Connection",
        default=True,
        help="When enabled, POS offline mode is disabled: the cashier is "
        "blocked from creating or sending orders while the connection to "
        "the server is lost.",
    )

    def _check_can_open_session(self):
        """Deny opening a new session to backend users whose linked
        employee is not allowed to open POS sessions."""
        self.ensure_one()
        # Deliberately independent of `enable_access_rights` (that toggle
        # only controls in-session cashier restrictions): who is allowed
        # to open the register is a separate, always-on concern as long
        # as employee login (pos_hr) is in use.
        if not self.module_pos_hr:
            return
        # Read with sudo(): the user opening the session may not have
        # read access to hr.employee, and a silently empty/None employee
        # would otherwise be treated as "no restriction applies".
        user = self.env.user.sudo()
        employee = user.employee_id
        if not employee:
            # employee_id is company-dependent; fall back to a direct
            # search in case of a multi-company mismatch.
            employee = self.env["hr.employee"].sudo().search(
                [("user_id", "=", user.id)], limit=1
            )
        if employee and not employee.pos_access_open_session:
            raise UserError(
                _(
                    "You are not allowed to open a new session for this "
                    "Point of Sale. Please contact your manager."
                )
            )

    def open_ui(self):
        if not self.current_session_id:
            self._check_can_open_session()
        return super().open_ui()


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
