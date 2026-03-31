import json
from pathlib import Path

# Indian states and union territories
STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli",
    "Daman and Diu", "Lakshadweep", "Delhi", "Puducherry", "Ladakh"
]

# Dataset categories for each sector
SECTOR_CATEGORIES = {
    "Health": [
        "COVID-19 Cases", "Hospital Admissions", "Disease Surveillance",
        "Immunization Records", "Birth and Death", "Health Infrastructure",
        "Medical Facilities", "Doctor Availability", "Bed Capacity",
        "Patient Statistics", "Mortality Rate", "Morbidity Data",
        "Blood Bank Data", "Vaccination Records", "Epidemic Tracking",
        "Health Expenditure", "Insurance Claims", "Treatment Data",
        "Recovery Rate", "Quarantine Data", "Testing Data", "Lab Reports",
        "Pharmacy Data", "Injury Statistics", "Nutrition Data", "Mental Health",
        "Maternal Health", "Child Health", "Elderly Care", "Disease Outbreak",
        "Public Health Survey", "Clinic Records", "Patient Demographics",
        "Medicine Distribution", "Surgery Records", "Emergency Cases",
        "ICU Occupancy", "Ventilator Usage", "Oxygen Supply", "PPE Stock",
        "Staff Strength", "Training Data", "Complaint Records", "Service Quality",
        "Telemedicine Data", "Health Camps", "Screening Results"
    ],
    "Education": [
        "School Enrollment", "Literacy Rates", "Drop-out Analysis",
        "Teacher-Student Ratio", "Higher Education Analytics",     
        "Primary School Infrastructure", "Examination Results", "Scholarship Grants",
        "Vocational Training", "Digital Classroom Metrics", "University Admissions",
        "Mid-day Meal Schemes", "Library Catalog", "Special Education",
        "Attendance Records", "Extracurricular Activities", "Alumni Data",
        "Faculty Credentials", "School Transport", "E-learning Access"
    ],
    "Transport": [
        "Road Traffic Statistics", "Public Transit Usage", "Accident Reports",
        "Highway Maintenance", "Vehicle Registrations", "Toll Collections",
        "Railway Passenger Flows", "Airport Traffic", "Port Operations",
        "Fuel Consumption", "EV Charging Stations", "Transport Subsidies",
        "Driving Licenses", "Traffic Violations", "Road Quality Metrics",
        "Freight Cargo Tonnage", "Metro Ridership", "Bridge Infrastructure"
    ],
    "Agriculture": [
        "Crop Production", "Soil Fertility", "Irrigation Methods",
        "Rainfall Statistics", "Fertilizer Usage", "Market Prices",
        "Pesticide Data", "Livestock Census", "Dairy Production",
        "Fisheries Yield", "Subsidies & Loans", "Agri-tech Implementations",
        "Harvest Reports", "Cold Storage Tech", "Export Statistics",
        "Organic Farming", "Tractor Registrations", "Seed Distribution"
    ],
    "Finance": [
        "Government Budget", "Tax Revenues", "State Expenditures",
        "Banking Penetration", "Digital Transactions", "GST Collections",
        "Foreign Direct Investment", "Public Debt", "Inflation Indexes",
        "Mutual Fund Growth", "Pension Schemes", "Credit Distribution",
        "Microfinance Metrics", "Stock Market Averages", "Economic Stimulus",
        "Insurance Policies", "Corporate Earnings", "SME Funding"
    ],
    "Census": [
        "Population Demographics", "Housing Statistics", "Employment Figures",
        "Migration Trends", "Household Amenities", "Language Diversity",
        "Urbanization Rates", "Age Distribution", "Gender Ratios",
        "Workforce Participation", "Poverty Indexes", "Tribal Population",
        "Vital Statistics", "Marital Status", "Education Levels",
        "Socio-economic Data", "Religious Affiliation", "Disability Stats"
    ]
}

def generate_sector_datasets(sector_name, categories):
    """Generate ~2000 datasets for a given sector covering all states"""
    datasets = []
    dataset_id = 1
    
    for state_idx, state in enumerate(STATES):
        datasets_per_state = 57 # 57 * 36 states = ~2052
        
        for cat_idx in range(datasets_per_state):
            category = categories[cat_idx % len(categories)]
            
            views = 1000 + (state_idx * 150) + (cat_idx * 45)
            downloads = 150 + (state_idx * 20) + (cat_idx * 6)
            
            # Make sure ID is globally unique per sector and state
            dataset = {
                "id": f"{sector_name.lower()}_{state_idx:02d}_{dataset_id:04d}",
                "title": f"{category} - {state} {2024}",
                "sector": sector_name,
                "state": state,
                "organization": f"{state} {sector_name} Department",
                "description": f"{category} dataset for {state} containing comprehensive metrics, statistics, and analysis for the year 2024.",
                "datasetCount": 120 + (dataset_id % 150),
                "apiCount": 2 + (dataset_id % 3),
                "views": views,
                "downloads": downloads,
                "updatedDate": f"2024-{((cat_idx % 12) + 1):02d}-{((cat_idx % 28) + 1):02d}",
                "publishedDate": f"2024-01-15",
                "category": category
            }
            
            datasets.append(dataset)
            dataset_id += 1
            
    return datasets

def create_datasets_json():
    """Create the datasets.json with full 2000+ datasets for ALL sectors properly mapped to states"""
    all_datasets = {}
    
    for sector, categories in SECTOR_CATEGORIES.items():
        all_datasets[sector] = generate_sector_datasets(sector, categories)
        print(f"Generated {len(all_datasets[sector])} {sector} datasets across all states.")

    # Save to file
    output_path = Path(__file__).resolve().parents[1] / "backend" / "data" / "datasets.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_datasets, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Saved robust multi-state datasets to {output_path}")
    print(f"📊 Total datasets: {sum(len(v) if isinstance(v, list) else 0 for v in all_datasets.values())}")

if __name__ == "__main__":
    create_datasets_json()
