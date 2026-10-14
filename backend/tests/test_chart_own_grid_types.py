"""Pie, boxplot and donut charts asked for together with another chart type.

They draw on a subplot grid of their own, which replaced the grid the other chart
types were placed on: "Create a boxplot chart for the distribution of X" (a boxplot
and a histogram, since "distribution" names the histogram) failed with Plotly's
"The (row, col) pair sent is out of range".
"""

import pandas as pd
import pytest

from veloiq_framework.utils.views_utils import jm_plot_chart_from_DataFrame


def _ticket_metrics_df():
    return pd.DataFrame({
        'TICKET_METRIC(máx)': pd.to_datetime(['2026-07-17'] * 4),
        'avg resolution time': [131.7, 1118.5, 1214.9, 664.3],
        'date': ['2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'],
    })


@pytest.mark.parametrize('chart_types, figures', [
    (['boxplot', 'histogram'], 2),
    (['pie', 'bar'], 2),
    (['boxplot'], 1),
    (['bar', 'line'], 1),
])
def test_each_own_grid_chart_type_is_drawn_on_its_own_figure(chart_types, figures):
    html = jm_plot_chart_from_DataFrame(
        None, _ticket_metrics_df(), chart_types,
        categorical_column_for_x_axis=[2], categorical_column_for_z_axis=[0],
        categorical_column_for_x_axis_name=['date'], categorical_column_for_z_axis_name=[None])
    assert html.count('plotly-graph-div') == figures
