# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request


class TableLockController(http.Controller):

    @http.route("/pos_access_rights/table/lock", type="json", auth="user")
    def acquire_table_lock(self, table_id, employee_id=None, session_id=None):
        """Acquire a lock on a table."""
        return request.env["restaurant.table"].sudo().acquire_lock(
            table_id, employee_id, session_id
        )

    @http.route("/pos_access_rights/table/unlock", type="json", auth="user")
    def release_table_lock(self, table_id):
        """Release a lock on a table."""
        return request.env["restaurant.table"].sudo().release_lock(table_id)

    @http.route("/pos_access_rights/table/refresh_lock", type="json", auth="user")
    def refresh_table_lock(self, table_id):
        """Refresh/extend a table lock."""
        return request.env["restaurant.table"].sudo().refresh_lock(table_id)

    @http.route("/pos_access_rights/table/locks_status", type="json", auth="user")
    def get_table_locks_status(self, table_ids):
        """Get lock status for multiple tables."""
        return request.env["restaurant.table"].sudo().get_locks_status(table_ids)
