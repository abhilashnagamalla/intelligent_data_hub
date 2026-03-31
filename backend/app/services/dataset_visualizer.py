import pandas as pd


def generate_charts(df):

    numeric_cols = df.select_dtypes(include="number").columns
    cat_cols = df.select_dtypes(exclude="number").columns

    charts = []

    if len(numeric_cols) > 0:

        y_col = numeric_cols[0]
        x_vals = df[cat_cols[0]].head(10).tolist() if len(cat_cols) > 0 else df.index[:10].tolist()

        charts.append({
            "type": "bar",
            "x": x_vals,
            "y": df[y_col].head(10).tolist(),
            "label": y_col
        })

        charts.append({
            "type": "line",
            "x": x_vals,
            "y": df[y_col].head(10).tolist(),
            "label": y_col
        })

    return charts