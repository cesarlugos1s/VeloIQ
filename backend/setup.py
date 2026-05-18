# Compatibility shim — lets `pip install -e .` work with older pip versions
# that don't support the PEP 660 build_editable hook.
from setuptools import setup
setup()
