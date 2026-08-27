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


class HrEmployeeBase(models.AbstractModel):
    _inherit = "hr.employee.base"

    # ── Discount & Pricing ──────────────────────────────────────────
    pos_access_discount = fields.Boolean(
        string="Can Apply Discount",
        default=True,
        help="Allow this employee to apply discounts in the POS.",
    )
    pos_access_max_discount = fields.Float(
        string="Max Discount %",
        default=100.0,
        help="Maximum discount percentage (0–100) this employee can "
        'apply.  Only effective when "Can Apply Discount" is enabled.',
    )
    pos_access_change_price = fields.Boolean(
        string="Can Change Price",
        default=True,
        help="Allow this employee to manually change product prices.",
    )
    pos_access_pricelist = fields.Boolean(
        string="Can Change Pricelist",
        default=True,
        help="Allow this employee to switch pricelists on orders.",
    )
    pos_access_fiscal_position = fields.Boolean(
        string="Can Change Fiscal Position",
        default=True,
        help="Allow this employee to change the fiscal position on orders.",
    )

    # ── Order Management ────────────────────────────────────────────
    pos_access_delete_order = fields.Boolean(
        string="Can Delete Orders",
        default=True,
        help="Allow this employee to delete or cancel POS orders.",
    )
    pos_access_delete_order_line = fields.Boolean(
        string="Can Remove Order Lines",
        default=True,
        help="Allow this employee to remove individual lines from orders.",
    )
    pos_access_refund = fields.Boolean(
        string="Can Process Refunds",
        default=True,
        help="Allow this employee to create refund orders.",
    )
    pos_access_reduce_quantity = fields.Boolean(
        string="Can Reduce Sent Quantity",
        default=True,
        help="Allow this employee to reduce an order line's quantity "
        "after it has already been sent to the kitchen/preparation. "
        "When disabled for the current cashier, reducing a sent "
        "quantity requires selecting a colleague who has this right "
        "and entering their PIN.",
    )

    # ── Payment ─────────────────────────────────────────────────────
    pos_access_payment = fields.Boolean(
        string="Can Validate Payment",
        default=True,
        help="Allow this employee to validate (complete) payments.",
    )
    pos_access_create_invoice = fields.Boolean(
        string="Can Create Invoice",
        default=True,
        help="Allow this employee to create invoices from the POS.",
    )
    pos_access_tip = fields.Boolean(
        string="Can Add Tips",
        default=True,
        help="Allow this employee to add customer tips.",
    )

    # ── Cash & Session ──────────────────────────────────────────────
    pos_access_cash_in_out = fields.Boolean(
        string="Can Cash In / Out",
        default=True,
        help="Allow this employee to perform cash in / cash out moves.",
    )
    pos_access_close_session = fields.Boolean(
        string="Can Close Session",
        default=True,
        help="Allow this employee to close the POS session.",
    )
    pos_access_open_session = fields.Boolean(
        string="Can Open Session",
        default=True,
        help="Allow this employee to open a new POS session from the "
        "backend. Checked against the employee linked to the backend "
        "user starting the session.",
    )

    # ── Customer & Product ──────────────────────────────────────────
    pos_access_customer = fields.Boolean(
        string="Can Set Customer",
        default=True,
        help="Allow this employee to set or change the customer on orders.",
    )
    pos_access_create_product = fields.Boolean(
        string="Can Create Products",
        default=True,
        help="Allow this employee to create new products from the POS.",
    )
    pos_access_backend = fields.Boolean(
        string="Can Access Backend",
        default=True,
        help="Allow this employee to switch to the Odoo backend from POS.",
    )

    # ── Table Locking ────────────────────────────────────────────────
    pos_access_table_lock_override = fields.Boolean(
        string="Can Override Table Locks",
        default=False,
        help="Allow this employee (manager) to access tables that are "
        "currently being used by other employees.",
    )


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    # ── Load fields into POS frontend ───────────────────────────────
    @api.model
    def _load_pos_data_fields(self, config_id):
        fields_list = super()._load_pos_data_fields(config_id)
        custom_fields = [
            "pos_access_discount",
            "pos_access_max_discount",
            "pos_access_change_price",
            "pos_access_pricelist",
            "pos_access_fiscal_position",
            "pos_access_delete_order",
            "pos_access_delete_order_line",
            "pos_access_refund",
            "pos_access_reduce_quantity",
            "pos_access_payment",
            "pos_access_create_invoice",
            "pos_access_tip",
            "pos_access_cash_in_out",
            "pos_access_close_session",
            "pos_access_customer",
            "pos_access_create_product",
            "pos_access_backend",
            "pos_access_table_lock_override",
        ]
        if fields_list:
            fields_list += custom_fields
            return fields_list
        return fields_list


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
