# -*- coding: utf-8 -*-

import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = "pos.order"

    cancel_reason = fields.Text(string="Cancel Reason", readonly=True, copy=False)
    cancel_by = fields.Char(string="Cancelled By", readonly=True, copy=False)
    cancel_date = fields.Datetime(string="Cancel Date", readonly=True, copy=False)

    @api.model
    def set_cancel_reason(self, order_id, reason, cancelled_by=""):
        """Store the reason entered in the POS right before the order is
        cancelled through the standard `action_pos_order_cancel`."""
        order = self.browse(order_id).exists()
        if not order or order.state != "draft":
            return False
        order.sudo().write({
            "cancel_reason": reason,
            "cancel_by": cancelled_by or self.env.user.name,
            "cancel_date": fields.Datetime.now(),
        })
        return True

    @api.model
    def move_split_preparation_history(self, source_uuid, destination_uuid, moves):
        """Carry the "already sent to preparation" history over a split bill.

        Split bill moves (part of) lines into a new order with new line
        uuids. pos_preparation_direct tracks printed quantities per
        (order uuid, line uuid), so without this the moved items print
        again on the next "send to kitchen" of the new order.

        `moves` is a list of {from, to, qty, total}: source line uuid, new
        line uuid, quantity moved and the source line quantity before the
        split. Like core's split, the source keeps its printed quantity
        first; only what exceeds the quantity left on it moves along.

        The history is recorded as adjustment jobs (ticket 0, never sent to
        a printer): +qty on the new order, -qty on the source order, so the
        real ticket records stay untouched.
        """
        if "pos.preparation.job" not in self.env or not moves:
            return False
        Job = self.env["pos.preparation.job"].sudo()
        jobs = Job.search([
            ("order_uuid", "=", source_uuid),
            ("state", "in", ("printed", "pending")),
        ])
        printed = {}   # {printer: {line_uuid: qty}}
        info = {}      # line_uuid -> (product_name, note) as last printed
        for job in jobs:
            per_line = printed.setdefault(job.printer_id, {})
            for item in job.line_data or []:
                luuid = item.get("line_uuid")
                if luuid:
                    per_line[luuid] = per_line.get(luuid, 0) + item.get("qty", 0)
                    info[luuid] = (item.get("product_name", ""), item.get("note", ""))

        source = self.sudo().search([("uuid", "=", source_uuid)], limit=1)
        destination = self.sudo().search([("uuid", "=", destination_uuid)], limit=1)
        table = (destination.table_id.table_number if destination.table_id else "") or ""
        now = fields.Datetime.now()
        created = 0
        for printer, per_line in printed.items():
            src_items, dst_items = [], []
            for move in moves:
                done = per_line.get(move.get("from"), 0)
                kept = max(move.get("total", 0) - move.get("qty", 0), 0)
                moved = max(done - kept, 0)
                if moved <= 0:
                    continue
                name, note = info.get(move["from"], ("", ""))
                src_items.append({"qty": -moved, "note": note, "line_uuid": move["from"], "product_name": name})
                dst_items.append({"qty": moved, "note": note, "line_uuid": move["to"], "product_name": name})
            if not dst_items:
                continue
            common = {
                "printer_id": printer.id,
                "state": "printed",
                "ticket_number": 0,
                "printed_date": now,
                "table_name": str(table),
                "error_message": "Not printed: print history moved by split bill",
            }
            Job.create([
                dict(common, order_uuid=source_uuid, order_id=source.id or False,
                     order_name=source.pos_reference or "", line_data=src_items,
                     print_request_id=f"split-out:{destination_uuid}"),
                dict(common, order_uuid=destination_uuid, order_id=destination.id or False,
                     order_name=destination.pos_reference or "", line_data=dst_items,
                     print_request_id=f"split-in:{destination_uuid}"),
            ])
            created += 1
        _logger.info(
            "[SplitBill] %s -> %s: moved print history for %d printer(s)",
            source_uuid, destination_uuid, created)
        return True

    @api.model
    def drop_transferred_order(self, order_uuid, destination_uuid, line_uuid_map=None):
        """Finish a table transfer onto a table that already had an order.

        The POS has already moved the lines into the destination order and
        synced it. The emptied source order is deleted here instead of going
        through `action_pos_order_cancel`, so transfers neither need the
        "delete order" access right nor show up as cancelled orders.

        Preparation print jobs of the source order are re-pointed to the
        destination order / lines so pos_preparation_direct does not print
        the moved items again on the next "send to kitchen".
        """
        line_uuid_map = line_uuid_map or {}
        destination = self.sudo().search([("uuid", "=", destination_uuid)], limit=1)
        if not destination:
            # Destination not saved on the server: keep the source order so
            # nothing is lost.
            _logger.warning(
                "[TableTransfer] destination %s not found, keeping source %s",
                destination_uuid, order_uuid)
            return False

        if "pos.preparation.job" in self.env:
            jobs = self.env["pos.preparation.job"].sudo().search(
                [("order_uuid", "=", order_uuid)])
            for job in jobs:
                job.write({
                    "order_uuid": destination_uuid,
                    "order_id": destination.id,
                    "line_data": [
                        dict(item, line_uuid=line_uuid_map.get(
                            item.get("line_uuid"), item.get("line_uuid")))
                        for item in (job.line_data or [])
                    ],
                })

        order = self.sudo().search([("uuid", "=", order_uuid)], limit=1)
        if not order:
            return True
        if order.state != "draft" or order.session_id.state == "closed":
            _logger.warning(
                "[TableTransfer] source order %s is %s, not deleting",
                order.id, order.state)
            return False

        config = order.config_id
        _logger.info(
            "[TableTransfer] order %s (%s) merged into %s (%s), deleting source",
            order.id, order.pos_reference, destination.id, destination.pos_reference)
        order.unlink()
        config.notify_synchronisation(
            config.current_session_id.id, self.env.context.get("login_number", 0))
        return True
