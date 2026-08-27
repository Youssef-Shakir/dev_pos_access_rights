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
        if not self.enable_access_rights or not self.module_pos_hr:
            return
        employee = self.env.user.employee_id
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
