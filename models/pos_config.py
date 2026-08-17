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


class PosConfig(models.Model):
    _inherit = "pos.config"

    enable_access_rights = fields.Boolean(
        string="Enable POS Access Rights",
        default=False,
        help="When enabled, per-employee access rights are enforced "
        "in the POS session.  Requires pos_hr (employee login).",
    )


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
