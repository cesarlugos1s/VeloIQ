"""Names and fixed values shared by the documentation workflow modules."""
from __future__ import annotations

#: The OpenSpec release the workflow was built and tested against.
PINNED_OPENSPEC_PACKAGE = "@fission-ai/openspec@2.2.0"

#: Name of the custom OpenSpec schema installed into each project.
CUSTOM_SCHEMA_NAME = "veloiq-docs"

#: Folder of OpenSpec inside a project, and its parts.
OPENSPEC_FOLDER_NAME = "openspec"
SPECIFICATIONS_FOLDER_NAME = "specs"
CHANGES_FOLDER_NAME = "changes"
ARCHIVE_FOLDER_NAME = "archive"
CHANGELOG_FILE_NAME = "CHANGELOG.md"
SPECIFICATION_FILE_NAME = "spec.md"

#: Element types of the Product Specification, each a folder under openspec/specs/.
ELEMENT_TYPE_JOURNEYS = "journeys"
ELEMENT_TYPE_CAPABILITIES = "capabilities"
ELEMENT_TYPE_FEATURES = "features"
ELEMENT_TYPE_BUSINESS_RULES = "business-rules"
ELEMENT_TYPE_ALGORITHMS = "algorithms"
ELEMENT_TYPE_NON_FUNCTIONAL_REQUIREMENTS = "non-functional-requirements"
ELEMENT_TYPE_IMPLEMENTATION = "implementation"
ELEMENT_TYPE_DATA_MODEL = "data-model"

#: The singular label written as `type` in each element's front matter, by element type folder.
ELEMENT_TYPE_SINGULAR_LABELS = {
    ELEMENT_TYPE_JOURNEYS: "journey",
    ELEMENT_TYPE_CAPABILITIES: "capability",
    ELEMENT_TYPE_FEATURES: "feature",
    ELEMENT_TYPE_BUSINESS_RULES: "business-rule",
    ELEMENT_TYPE_ALGORITHMS: "algorithm",
    ELEMENT_TYPE_NON_FUNCTIONAL_REQUIREMENTS: "non-functional-requirement",
    ELEMENT_TYPE_IMPLEMENTATION: "implementation-element",
    ELEMENT_TYPE_DATA_MODEL: "entity",
}

#: Element types that changes may carry deltas for (the data model is generated from the code).
AUTHORED_ELEMENT_TYPES = (
    ELEMENT_TYPE_JOURNEYS,
    ELEMENT_TYPE_CAPABILITIES,
    ELEMENT_TYPE_FEATURES,
    ELEMENT_TYPE_BUSINESS_RULES,
    ELEMENT_TYPE_ALGORITHMS,
    ELEMENT_TYPE_NON_FUNCTIONAL_REQUIREMENTS,
    ELEMENT_TYPE_IMPLEMENTATION,
)

#: Element types whose names are the names in the code, so they are not required to be kebab-case.
CODE_NAMED_ELEMENT_TYPES = (ELEMENT_TYPE_IMPLEMENTATION, ELEMENT_TYPE_DATA_MODEL)

ALL_ELEMENT_TYPES = AUTHORED_ELEMENT_TYPES + (ELEMENT_TYPE_DATA_MODEL,)

#: Section headings OpenSpec uses in delta specs.
DELTA_HEADING_ADDED = "## ADDED Requirements"
DELTA_HEADING_MODIFIED = "## MODIFIED Requirements"
DELTA_HEADING_REMOVED = "## REMOVED Requirements"
DELTA_HEADING_RENAMED = "## RENAMED Requirements"

#: Marker that tells the code scanner which specification element a function or class implements.
CODE_MARKER_KEYWORD = "spec:"

#: Version label used when the product has no git tag yet.
UNRELEASED_VERSION_LABEL = "unreleased"
