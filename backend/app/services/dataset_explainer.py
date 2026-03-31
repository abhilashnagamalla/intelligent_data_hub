import pandas as pd


def explain_dataset(df):

    columns = list(df.columns)

    summary = f"""
Dataset contains {len(df)} rows and {len(columns)} columns.

Columns:
{', '.join(columns)}

Numeric Columns:
{', '.join(df.select_dtypes(include='number').columns)}
"""

    return summary