from app.services.dataset_catalog import (
    load_summary_sync_state,
    refresh_summary_files,
    sector_keys,
    summary_file_for_sector,
)


def main() -> None:
    refresh_summary_files(force=True)
    state = load_summary_sync_state()
    for sector in sector_keys():
        info = state.get(sector, {})
        print(
            f"{sector}: source={info.get('source', 'unknown')} "
            f"datasets={info.get('datasetCount', 0)} "
            f"file={summary_file_for_sector(sector)}"
        )


if __name__ == "__main__":
    main()
