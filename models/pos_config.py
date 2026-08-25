# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2015 DevIntelle Consulting Service Pvt.Ltd (<http://www.devintellecs.com>).
#
#    For Module Support : devintelle@gmail.com  or Skype : devintelle
#
##############################################################################


from odoo import api, fields, models


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
        "the server is lost, and the maximum time without internet is "
        "forced to 0.",
    )

    def _force_max_time_without_internet(self):
        """Force max_time_without_internet to 0 on configs that require a
        network connection, effectively disabling POS offline mode."""
        to_force = self.filtered(
            lambda c: c.require_network_connection and c.max_time_without_internet != 0
        )
        if to_force:
            super(PosConfig, to_force).write({"max_time_without_internet": 0})

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._force_max_time_without_internet()
        return records

    def write(self, vals):
        res = super().write(vals)
        self._force_max_time_without_internet()
        return res


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
