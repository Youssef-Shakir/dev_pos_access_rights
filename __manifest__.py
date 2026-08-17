# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2015 DevIntelle Consulting Service Pvt.Ltd (<http://www.devintellecs.com>).
#
#    For Module Support : devintelle@gmail.com  or Skype : devintelle
#
##############################################################################


{
    "name": "POS Access Rights",
    "version": "18.0.1.0",
    "sequence": 1,
    "category": "Point of Sale",
    "summary": "Granular per-employee access rights for POS operations",
    "description": """
POS Access Rights — Granular Employee Permissions for Point of Sale
====================================================================

Control exactly what each POS employee can and cannot do. This module adds
**17 configurable permission fields** to every employee record, letting you
build fine-grained access policies for your retail cashiers, shift managers,
and store supervisors.

    """,
    "depends": ["pos_hr"],
    "data": [
        "views/hr_employee_views.xml",
        "views/pos_config_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "dev_pos_access_rights/static/src/**/*",
        ],
    },
    'demo': [],
    'test': [],
    'css': [],
    'qweb': [],
    'js': [],
    'images': ['images/main_screenshot.png'],
    'installable': True,
    'application': True,
    'auto_install': False,
    
    #author and support Details
    'author': 'DevIntelle Consulting Service Pvt.Ltd',
    'website': 'https://www.devintellecs.com',    
    'maintainer': 'DevIntelle Consulting Service Pvt.Ltd', 
    'support': 'devintelle@gmail.com',
    'price':11.0,
    'currency':'EUR',
    #'live_test_url':'https://youtu.be/A5kEBboAh_k',
    "license": "LGPL-3",
}


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
