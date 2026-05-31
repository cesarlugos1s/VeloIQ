// AUTO-GENERATED — do not edit. Sync from VeloIQ extension schema pipeline.
import type { ModelDef } from '@juicemantics/veloiq-ui';

export const nlpModelsGen: ModelDef[] = [
  {
    name: "NLChat",
    label: "NL Chat",
    resource: "cw_nlchat",
    pkField: "eid",
    fields: [
      { key: "nl_chat_name", label: "Name", type: "string" },
      { key: "nl_chat_description", label: "Description", type: "string", showViewType: "read-only-markdown", editViewType: "editable-markdown" },
      {
        key: "nl_chat_language", label: "Language", type: "string",
        options: [{ label: "English", value: "en" }, { label: "Spanish", value: "es" }],
        valueColors: { "en": "blue", "es": "geekblue" },
      },
      { key: "show_nl_chat_composition", label: "Show Composition", type: "boolean" },
      { key: "show_results_context", label: "Show Results Context", type: "boolean" },
      {
        key: "nl_chat_view_type", label: "View Type", type: "string",
        options: [
          { label: "Primary", value: "primary" },
          { label: "Editable Table", value: "editable-table" },
          { label: "Table", value: "table" },
          { label: "List", value: "list" },
        ],
      },
      { key: "large_row_threshold", label: "Large Row Threshold", type: "number" },
      {
        key: "nl_chat_large_results_view_type", label: "Large Results View", type: "string",
        options: [
          { label: "Editable Table", value: "editable-table" },
          { label: "Table", value: "table" },
          { label: "List", value: "list" },
        ],
      },
      { key: "maximum_chart_columns", label: "Max Chart Columns", type: "number" },
      { key: "row_limit", label: "Row Limit", type: "number" },
    ],
    relations: [
      { resource: "has_nl_sentence_relation", targetKey: "eid_from", label: "NL Sentences" },
    ],
  },
  {
    name: "NLSentence",
    label: "NL Sentence",
    resource: "cw_nlsentence",
    pkField: "eid",
    fields: [
      { key: "nl_sentence_name", label: "Name", type: "string" },
      { key: "nl_sentence", label: "NL Sentence", type: "string" },
      { key: "nl_sentence_description", label: "Description", type: "string", showViewType: "read-only-markdown", editViewType: "editable-markdown" },
      {
        key: "nl_sentence_language", label: "Language", type: "string",
        options: [{ label: "English", value: "en" }, { label: "Spanish", value: "es" }],
        valueColors: { "en": "blue", "es": "geekblue" },
      },
      { key: "nl_asks_sentence", label: "Asks Sentence", type: "string" },
      { key: "show_nl_sentence_composition", label: "Show Composition", type: "boolean" },
      { key: "show_nl_sub_sentences_composition", label: "Show Sub-Sentences", type: "boolean" },
      { key: "show_results_context", label: "Show Results Context", type: "boolean" },
      {
        key: "nl_sentence_view_type", label: "View Type", type: "string",
        options: [
          { label: "Primary", value: "primary" },
          { label: "Editable Table", value: "editable-table" },
          { label: "Table", value: "table" },
          { label: "List", value: "list" },
        ],
      },
      { key: "large_row_threshold", label: "Large Row Threshold", type: "number" },
      {
        key: "nl_sentence_large_results_view_type", label: "Large Results View", type: "string",
        options: [
          { label: "Editable Table", value: "editable-table" },
          { label: "Table", value: "table" },
          { label: "List", value: "list" },
        ],
      },
      { key: "maximum_chart_columns", label: "Max Chart Columns", type: "number" },
      { key: "row_limit", label: "Row Limit", type: "number" },
    ],
    relations: [],
  },
];

export default nlpModelsGen;
