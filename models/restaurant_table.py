# -*- coding: utf-8 -*-

from odoo import api, fields, models
from datetime import datetime, timedelta


class RestaurantTable(models.Model):
    _inherit = "restaurant.table"

    # ── Table Lock Fields ────────────────────────────────────────────
    lock_user_id = fields.Many2one(
        "res.users",
        string="Locked By User",
        help="The user currently accessing this table.",
    )
    lock_employee_id = fields.Many2one(
        "hr.employee",
        string="Locked By Employee",
        help="The employee currently accessing this table.",
    )
    lock_time = fields.Datetime(
        string="Lock Time",
        help="When the table was locked.",
    )
    lock_session_id = fields.Many2one(
        "pos.session",
        string="Lock Session",
        help="The POS session that locked this table.",
    )

    # ── Lock timeout in seconds (configurable, default 60s) ─────────
    LOCK_TIMEOUT_SECONDS = 60

    def _is_lock_expired(self):
        """Check if the current lock has expired."""
        if not self.lock_time:
            return True
        expiry = self.lock_time + timedelta(seconds=self.LOCK_TIMEOUT_SECONDS)
        return datetime.now() >= expiry

    def _clear_lock(self):
        """Clear the lock on this table."""
        self.write({
            "lock_user_id": False,
            "lock_employee_id": False,
            "lock_time": False,
            "lock_session_id": False,
        })

    @api.model
    def acquire_lock(self, table_id, employee_id, session_id):
        """
        Attempt to acquire a lock on the table.
        Returns dict with success status and lock info.
        """
        table = self.browse(table_id)
        if not table.exists():
            return {"success": False, "error": "Table not found"}

        user = self.env.user
        employee = self.env["hr.employee"].browse(employee_id) if employee_id else None

        # Check if table is already locked by someone else
        if table.lock_user_id and table.lock_user_id.id != user.id:
            # Check if lock has expired
            if table._is_lock_expired():
                table._clear_lock()
            else:
                # Check if current user is a manager who can override
                can_override = False
                if employee and employee.pos_access_table_lock_override:
                    can_override = True

                if not can_override:
                    return {
                        "success": False,
                        "error": "locked",
                        "locked_by": table.lock_employee_id.name or table.lock_user_id.name or "Unknown",
                        "lock_time": table.lock_time.isoformat() if table.lock_time else None,
                    }

        # Acquire the lock
        table.write({
            "lock_user_id": user.id,
            "lock_employee_id": employee_id,
            "lock_time": datetime.now(),
            "lock_session_id": session_id,
        })

        return {"success": True}

    @api.model
    def release_lock(self, table_id):
        """Release the lock on a table."""
        table = self.browse(table_id)
        if not table.exists():
            return {"success": False, "error": "Table not found"}

        user = self.env.user

        # Only release if current user holds the lock (or lock expired)
        if table.lock_user_id.id == user.id or table._is_lock_expired():
            table._clear_lock()
            return {"success": True}

        return {"success": False, "error": "Not your lock"}

    @api.model
    def refresh_lock(self, table_id):
        """Refresh/extend the lock timeout."""
        table = self.browse(table_id)
        if not table.exists():
            return {"success": False}

        user = self.env.user
        if table.lock_user_id.id == user.id:
            table.write({"lock_time": datetime.now()})
            return {"success": True}

        return {"success": False}

    @api.model
    def get_locks_status(self, table_ids):
        """Get lock status for multiple tables."""
        tables = self.browse(table_ids)
        result = {}

        for table in tables:
            if table.lock_user_id and not table._is_lock_expired():
                result[table.id] = {
                    "locked": True,
                    "locked_by": table.lock_employee_id.name or table.lock_user_id.name or "Unknown",
                    "lock_user_id": table.lock_user_id.id,
                    "lock_employee_id": table.lock_employee_id.id if table.lock_employee_id else False,
                }
            else:
                # Clear expired lock
                if table.lock_user_id and table._is_lock_expired():
                    table._clear_lock()
                result[table.id] = {"locked": False}

        return result

    @api.model
    def _load_pos_data_fields(self, config_id):
        """Load lock fields into POS."""
        fields_list = super()._load_pos_data_fields(config_id)
        fields_list += [
            "lock_user_id",
            "lock_employee_id",
            "lock_time",
        ]
        return fields_list
