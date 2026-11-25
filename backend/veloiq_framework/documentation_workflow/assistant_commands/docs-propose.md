Create a documentation change for: $ARGUMENTS

1. Run `veloiq docs change new <change-name>` with a short outcome name in kebab-case.
2. Write, in English, the artifacts the veloiq-docs schema lists (`openspec status --change <change-name>`): proposal, epics, stories, element delta specs under specs/<element-type>/<element-name>/, high-level design, low-level designs and tasks.
3. Name every element descriptively in kebab-case; never use numbered identifiers.
4. Run `veloiq docs change validate <change-name>` and fix every error.
