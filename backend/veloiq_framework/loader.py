"""Compatibility alias of :mod:`veloiq_framework.load_app_and_extension_modules`.

The module loader was renamed to an explicit name. Extensions, deploy scripts
and compiled wheels that still import ``veloiq_framework.loader`` get the very
same module object (private helpers and monkeypatching included), so they keep
working until their sources are updated.
"""
import sys

from veloiq_framework import load_app_and_extension_modules as _renamed_module

sys.modules[__name__] = _renamed_module
