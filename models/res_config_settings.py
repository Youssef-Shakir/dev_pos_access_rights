# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2015 DevIntelle Consulting Service Pvt.Ltd (<http://www.devintellecs.com>).
#
#    For Module Support : devintelle@gmail.com  or Skype : devintelle
#
##############################################################################


from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    pos_enable_access_rights = fields.Boolean(
        string="Enable POS Access Rights",
        related="pos_config_id.enable_access_rights",
        readonly=False,
    )

    pos_require_network_connection = fields.Boolean(
        string="Require Network Connection",
        related="pos_config_id.require_network_connection",
        readonly=False,
    )


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
