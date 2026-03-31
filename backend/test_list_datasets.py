from app.services.data_service import list_datasets

print('finance count', len(list_datasets('finance')))
print(list_datasets('finance')[:5])
