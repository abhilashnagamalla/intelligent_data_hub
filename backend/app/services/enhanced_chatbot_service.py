"""
Enhanced Chatbot Service with Category-Specific Responses
Handles A-H categories with state filtering, sector extraction, and structured responses
"""

import json
from typing import Any, Dict, List, Optional, Set, Tuple
from app.services.dataset_catalog import (
    detect_query_domains,
    detect_query_states,
    normalize_search_text,
    normalize_sector_key,
    sector_label,
    SECTOR_ALIASES,
    search_datasets,
    sector_catalog_datasets,
    enrich_dataset,
    RAW_STATE_FILTER_ALIASES,
)

# ============================================================================
# STATE CODE TO NAME MAPPING
# ============================================================================

STATE_CODE_TO_NAME = {
    "AP": "Andhra Pradesh",
    "AR": "Arunachal Pradesh",
    "AS": "Assam",
    "BR": "Bihar",
    "CG": "Chhattisgarh",
    "GA": "Goa",
    "GJ": "Gujarat",
    "HR": "Haryana",
    "HP": "Himachal Pradesh",
    "JK": "Jammu & Kashmir",
    "JH": "Jharkhand",
    "KA": "Karnataka",
    "KL": "Kerala",
    "MP": "Madhya Pradesh",
    "MH": "Maharashtra",
    "MN": "Manipur",
    "ML": "Meghalaya",
    "MZ": "Mizoram",
    "NL": "Nagaland",
    "OD": "Odisha",
    "PB": "Punjab",
    "RJ": "Rajasthan",
    "SK": "Sikkim",
    "TN": "Tamil Nadu",
    "TG": "Telangana",
    "TR": "Tripura",
    "UT": "Uttarakhand",
    "UP": "Uttar Pradesh",
    "WB": "West Bengal",
    "AN": "Andaman & Nicobar Islands",
    "CH": "Chandigarh",
    "DL": "Delhi",
    "PY": "Puducherry",
}

# ============================================================================
# CATEGORY DEFINITIONS AND KEYWORDS
# ============================================================================

class QueryCategory:
    """Query category enumeration"""
    GENERAL_PLATFORM = "general_platform"
    DATASET_DISCOVERY = "dataset_discovery"
    DATA_UNDERSTANDING = "data_understanding"
    DATA_ANALYSIS = "data_analysis"
    SECTOR_SPECIFIC = "sector_specific"
    ACTION_BASED = "action_based"
    CAPABILITY = "capability"
    ERROR_HANDLING = "error_handling"


CATEGORY_A_KEYWORDS = {
    "what is intelligent data hub",
    "what is idh",
    "platform overview",
    "what can i do",
    "what kind of data",
    "how can i use",
    "real-time",
    "static",
    "updated when",
    "where data from",
    "free to use",
    "reliable",
    "data quality",
}

CATEGORY_B_KEYWORDS = {
    "show datasets",
    "find datasets",
    "filter datasets",
    "highest usage",
    "most downloaded",
    "agriculture datasets",
    "healthcare datasets",
    "transport datasets",
    "finance datasets",
    "education datasets",
    "census datasets",
}

CATEGORY_C_KEYWORDS = {
    "what does",
    "explain dataset",
    "columns",
    "fields",
    "schema",
    "structure",
    "preview",
    "sample",
    "source",
    "last updated",
}

CATEGORY_D_KEYWORDS = {
    "average",
    "maximum",
    "minimum",
    "trend",
    "summary",
    "top states",
    "highest",
    "compare",
    "pattern",
    "anomalies",
    "analysis",
    "insights",
}

CATEGORY_F_KEYWORDS = {
    "download",
    "export",
    "csv",
    "visualize",
    "chart",
    "graph",
    "save dataset",
}

CATEGORY_G_KEYWORDS = {
    "suggest",
    "recommendation",
    "best dataset",
    "simplify",
    "beginner",
}

# ============================================================================
# PLATFORM OVERVIEW RESPONSES
# ============================================================================

def get_platform_overview() -> str:
    """Return comprehensive platform overview for 'What is Intelligent Data Hub' queries"""
    return """# About Intelligent Data Hub 🌍

**Intelligent Data Hub** is a comprehensive platform for accessing and analyzing Indian government data.

## Key Features:
- **📊 6 Sectors**: Agriculture, Healthcare, Finance, Education, Transport, Census & Surveys
- **🔍 Advanced Catalog**: Browse and search across thousands of datasets
- **📈 Visualization Support**: Create charts, graphs, and interactive visualizations
- **🧮 Analysis Tools**: Perform statistical analysis and identify trends
- **🌐 Multilingual Support**: Access data in multiple languages
- **✅ High Reliability**: Data sourced from official government sources (data.gov.in)
- **💰 Free Access**: Completely free to use, no subscription needed

## Data Characteristics:
- **Real-time with Weekly Updates**: Data refreshed regularly for current insights
- **Primary Source**: data.gov.in (Official Indian Government Data Portal)
- **Reliability**: High confidence data posted by government authorities
- **Coverage**: All-India level with state-wise breakdowns

## What you can do:
✅ Retrieve data by sector, state, or topic
✅ View geographic data with interactive maps (GeoView)
✅ Perform analysis and generate insights
✅ Download datasets in multiple formats
✅ Create custom visualizations
"""


def get_available_sectors() -> str:
    """Return information about available sectors"""
    sectors = [
        "🌾 **Agriculture**: Crop production, yield, rainfall data",
        "🏥 **Healthcare**: Disease statistics, vaccination data, hospital availability",
        "🚗 **Transport**: Traffic density, road accidents, public transport usage",
        "💰 **Finance**: Government expenditure, GDP trends, inflation",
        "📚 **Education**: Literacy rates, school enrollment, dropout rates",
        "👥 **Census & Surveys**: Population trends, urban vs rural, household data",
    ]
    return "## Available Sectors:\n\n" + "\n".join(sectors)


def get_usage_guide() -> str:
    """Return guide on how to use the platform"""
    return """## How to Use Intelligent Data Hub:

### 1. **Data Retrieval** 📥
- Browse datasets by sector
- Search by keywords or state
- Filter by year or time period
- View dataset metadata and descriptions

### 2. **GeoView** 🗺️
- Interactive map visualization
- View data by state/region
- Identify geographic patterns
- Compare regions visually

### 3. **Analysis** 📊
- Statistical summaries
- Trend identification
- Pattern recognition
- Cross-dataset comparisons

### 4. **Download & Export** 💾
- Download in CSV format
- Export filtered data
- Batch downloads available
- Multiple format options

### 5. **Visualization** 📈
- Create custom charts
- Generate graphs automatically
- Interactive dashboards
- Save visualizations
"""

# ============================================================================
# CATEGORY A: GENERAL PLATFORM QUESTIONS
# ============================================================================

def handle_category_a_query(query: str) -> Dict[str, Any]:
    """Handle Category A: General Platform Questions"""
    normalized = normalize_search_text(query).lower()

    # What is Intelligent Data Hub
    if any(phrase in normalized for phrase in ["what is", "tell me about", "intelligent data hub"]):
        return {
            "category": "general_platform",
            "type": "platform_overview",
            "response": get_platform_overview(),
            "quick_actions": [
                {"label": "View Available Sectors", "action": "show_sectors"},
                {"label": "How to Use", "action": "show_usage_guide"},
            ]
        }

    # What kind of data is available
    if any(phrase in normalized for phrase in ["what kind of data", "what data", "available data"]):
        return {
            "category": "general_platform",
            "type": "available_data",
            "response": get_available_sectors(),
            "quick_actions": [
                {"label": "Browse Agriculture Datasets", "action": "show_sector:agriculture"},
                {"label": "Browse Healthcare Datasets", "action": "show_sector:healthcare"},
            ]
        }

    # How to use the platform
    if any(phrase in normalized for phrase in ["how can i use", "how to use", "getting started"]):
        return {
            "category": "general_platform",
            "type": "usage_guide",
            "response": get_usage_guide(),
            "quick_actions": [
                {"label": "Browse Datasets", "action": "browse_datasets"},
                {"label": "Start Analysis", "action": "start_analysis"},
            ]
        }

    # Is data real-time or static
    if any(phrase in normalized for phrase in ["real-time", "static", "updated", "how often"]):
        return {
            "category": "general_platform",
            "type": "data_freshness",
            "response": """## Data Freshness ⏰

**Real-time with Weekly Updates**
- Data is refreshed weekly to ensure current information
- Most datasets reflect the latest available official data
- Some historical datasets are available for trend analysis
- Update frequency varies by dataset type

This ensures you have:
✅ Recent insights for current decision-making
✅ Historical data for trend analysis
✅ Government-verified information
""",
            "quick_actions": []
        }

    # Where does data come from
    if any(phrase in normalized for phrase in ["where data from", "data source", "data coming from", "origin"]):
        return {
            "category": "general_platform",
            "type": "data_source",
            "response": """## Data Source 🔗

**Primary Source: data.gov.in**
- Official Indian Government Data Portal
- Authorized government ministries and departments
- Ministry of Statistics and Programme Implementation (MoSPI)
- Various state and national agencies

## Data Reliability ✅

**Highly Reliable** - Data is posted by government authorities meaning:
- Verified and validated data
- Official government statistics
- Regularly audited sources
- Published with proper documentation
- Suitable for research, policy analysis, and business decisions

All datasets include source attribution and can be traced back to official government releases.
""",
            "quick_actions": []
        }

    # Is it free to use
    if any(phrase in normalized for phrase in ["free", "cost", "paid", "subscription", "price"]):
        return {
            "category": "general_platform",
            "type": "pricing",
            "response": """## Pricing & Access 💰

**Absolutely Free to Use!** ✅
- No subscription required
- No hidden costs
- No registration fees
- No usage limits
- Free downloads
- Free visualizations
- Free analysis tools

All datasets on Intelligent Data Hub are publicly available government data, 
provided free of cost to support research, analysis, and informed decision-making.
""",
            "quick_actions": []
        }

    return None


# ============================================================================
# CATEGORY B: DATASET DISCOVERY QUESTIONS
# ============================================================================

def extract_sector_from_query(query: str) -> Optional[str]:
    """Extract sector from query"""
    normalized = normalize_search_text(query).lower()
    
    for sector_key, aliases in SECTOR_ALIASES.items():
        for alias in aliases:
            if normalize_search_text(alias).lower() in normalized:
                return sector_key
    
    return None


def extract_state_from_query(query: str) -> Optional[str]:
    """Extract state from query"""
    states = detect_query_states(normalize_search_text(query))
    return next(iter(states), None) if states else None


def get_state_name(state_code: str) -> str:
    """Get full state name from state code"""
    return STATE_CODE_TO_NAME.get(state_code, state_code)


def handle_category_b_query(query: str, matches: List[Dict[str, Any]], total_count: int) -> Dict[str, Any]:
    """Handle Category B: Dataset Discovery Questions"""
    normalized = normalize_search_text(query).lower()
    
    sector = extract_sector_from_query(query)
    state = extract_state_from_query(query)

    sector_text = sector_label(sector) if sector else "all sectors"
    state_text = f" in {get_state_name(state)}" if state else ""
    
    # Show datasets related to sector
    if matches:
        message = f"## Found {total_count} dataset(s) in {sector_text}{state_text}\n\n"
        message += f"**Showing Top {len(matches)} Results:**\n\n"
        
        for i, dataset in enumerate(matches, 1):
            message += f"{i}. **{dataset.get('title', 'Untitled')}**\n"
            if dataset.get('description'):
                desc = dataset['description'][:100] + "..." if len(dataset.get('description', '')) > 100 else dataset.get('description', '')
                message += f"   {desc}\n"
            message += "\n"
        
        if total_count > len(matches):
            message += f"\n_Showing {len(matches)} of {total_count} total datasets_"
        
        return {
            "category": "dataset_discovery",
            "sector": sector,
            "state": state,
            "total_count": total_count,
            "response": message,
            "quick_actions": [
                {"label": "View Dataset Details", "action": "show_details"},
                {"label": "Filter by State", "action": "filter_state"},
            ] if state is None else []
        }
    
    return {
        "category": "dataset_discovery",
        "sector": sector,
        "state": state,
        "total_count": 0,
        "response": f"No datasets found in {sector_text}{state_text}. Try a different sector or state.",
        "quick_actions": [
            {"label": "Browse All Sectors", "action": "browse_sectors"},
            {"label": "Try Different State", "action": "select_state"},
        ]
    }


# ============================================================================
# CATEGORY C: DATA UNDERSTANDING QUESTIONS
# ============================================================================

def handle_category_c_query(query: str, dataset: Dict[str, Any]) -> Dict[str, Any]:
    """Handle Category C: Data Understanding Questions"""
    normalized = normalize_search_text(query).lower()
    
    response = f"## Dataset: {dataset.get('title', 'Unknown')}\n\n"
    
    # What does this dataset represent
    if any(phrase in normalized for phrase in ["what does", "represent", "explain"]):
        response += f"**Description:**\n{dataset.get('description', 'No description available')}\n\n"
        
        if dataset.get('tags'):
            response += f"**Tags:** {', '.join(dataset['tags'][:5])}\n\n"
        
        response += f"**Source:** data.gov.in\n"
        
        return {
            "category": "data_understanding",
            "type": "dataset_overview",
            "response": response,
        }
    
    # What are the columns
    if any(phrase in normalized for phrase in ["columns", "fields", "attributes", "schema"]):
        response += "**Columns/Fields:**\n\n"
        if dataset.get('columns'):
            cols = dataset['columns']
            if isinstance(cols, list):
                for col in cols[:15]:  # Show first 15 columns
                    response += f"- {col}\n"
            else:
                response += str(cols)
        else:
            response += "_Column information not available. Open the dataset to view._\n"
        
        return {
            "category": "data_understanding",
            "type": "schema",
            "response": response,
        }
    
    # When was data last updated
    if any(phrase in normalized for phrase in ["last updated", "updated when", "update date"]):
        response += f"**Last Updated:**\n"
        if dataset.get('updatedDate'):
            response += f"📅 {dataset['updatedDate']}\n\n"
        else:
            response += "Information not available\n\n"
        response += "**Update Frequency:** Weekly\n"
        
        return {
            "category": "data_understanding",
            "type": "update_info",
            "response": response,
        }
    
    # Source information
    if any(phrase in normalized for phrase in ["source", "from where"]):
        response += f"**Data Source:** data.gov.in\n"
        response += f"**Source URL:** {dataset.get('sourceUrl', 'Available in dataset')}\n"
        
        return {
            "category": "data_understanding",
            "type": "source_info",
            "response": response,
        }
    
    return {
        "category": "data_understanding",
        "type": "general_info",
        "response": response,
    }


# ============================================================================
# CATEGORY D: DATA ANALYSIS QUESTIONS
# ============================================================================

def handle_category_d_query(query: str, dataset: Dict[str, Any]) -> Dict[str, Any]:
    """Handle Category D: Data Analysis Questions"""
    normalized = normalize_search_text(query).lower()
    
    response = f"## Analysis: {dataset.get('title', 'Dataset')}\n\n"
    
    if any(phrase in normalized for phrase in ["summary", "summarize", "overview"]):
        response += "### Dataset Summary\n\n"
        response += f"- **Records:** {dataset.get('records', 'Unknown')}\n"
        response += f"- **Columns:** {len(dataset.get('columns', []))}\n"
        response += f"- **Last Updated:** {dataset.get('updatedDate', 'Unknown')}\n"
        response += f"- **Source:** data.gov.in\n\n"
        response += "**Analysis capabilities:**\n"
        response += "- View data summary statistics\n"
        response += "- Identify trends and patterns\n"
        response += "- Compare across states/regions\n"
        
        return {
            "category": "data_analysis",
            "type": "summary",
            "response": response,
            "quick_actions": [
                {"label": "View Full Analysis", "action": "analyze"},
                {"label": "Visualize Data", "action": "visualize"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["average", "maximum", "minimum", "max", "min", "average value"]):
        response += "### Statistical Analysis\n\n"
        response += "_Use the Analyze feature to see:_\n"
        response += "- Average values\n"
        response += "- Maximum and minimum values\n"
        response += "- Distribution patterns\n"
        response += "- State-wise comparisons\n"
        
        return {
            "category": "data_analysis",
            "type": "statistics",
            "response": response,
            "quick_actions": [
                {"label": "Run Analysis", "action": "analyze"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["top states", "highest", "lowest", "compare"]):
        response += "### State Comparison\n\n"
        response += "_Rankings and comparisons available for:_\n"
        response += "- Top performing states\n"
        response += "- Lowest performing regions\n"
        response += "- Year-over-year trends\n"
        response += "- Cross-state analysis\n"
        
        return {
            "category": "data_analysis",
            "type": "comparison",
            "response": response,
            "quick_actions": [
                {"label": "Compare States", "action": "compare_states"},
                {"label": "View Top States", "action": "top_states"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["trend", "pattern", "anomal"]):
        response += "### Trend & Pattern Analysis\n\n"
        response += "_Available insights:_\n"
        response += "- Growth or decline trends\n"
        response += "- Seasonal patterns\n"
        response += "- Anomalies or outliers\n"
        response += "- Correlation with other factors\n"
        
        return {
            "category": "data_analysis",
            "type": "trends",
            "response": response,
            "quick_actions": [
                {"label": "Analyze Trends", "action": "analyze_trends"},
                {"label": "Visualize Pattern", "action": "visualize_pattern"},
            ]
        }
    
    return {
        "category": "data_analysis",
        "type": "generic",
        "response": response + "Use the analysis features to explore this dataset.",
    }


# ============================================================================
# CATEGORY F: ACTION-BASED QUESTIONS
# ============================================================================

def handle_category_f_query(query: str, dataset: Dict[str, Any]) -> Dict[str, Any]:
    """Handle Category F: Action-Based Questions"""
    normalized = normalize_search_text(query).lower()
    
    if any(phrase in normalized for phrase in ["download", "export", "csv"]):
        return {
            "category": "action_based",
            "type": "download",
            "response": f"## Download {dataset.get('title', 'Dataset')}\n\n**Download Options:**\n- CSV format\n- Excel format\n- JSON format\n\nClick the dataset card to access download options.",
            "quick_actions": [
                {"label": "Download CSV", "action": "download:csv"},
                {"label": "Download Excel", "action": "download:xlsx"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["visualize", "chart", "graph"]):
        return {
            "category": "action_based",
            "type": "visualization",
            "response": f"## Visualize {dataset.get('title', 'Dataset')}\n\n**Visualization Types Available:**\n- Line charts (trends)\n- Bar charts (comparisons)\n- Pie charts (distributions)\n- Maps (geographic data)\n- Custom dashboards\n\nOpen the dataset to access visualization tools.",
            "quick_actions": [
                {"label": "Create Chart", "action": "create_chart"},
                {"label": "Build Dashboard", "action": "build_dashboard"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["save", "bookmark"]):
        return {
            "category": "action_based",
            "type": "save",
            "response": f"## Save {dataset.get('title', 'Dataset')}\n\n**Save Options:**\n- Bookmark for quick access\n- Add to favorites\n- Create custom collections\n- Save analysis results",
            "quick_actions": [
                {"label": "Bookmark Dataset", "action": "bookmark"},
                {"label": "Add to Collection", "action": "add_collection"},
            ]
        }
    
    return None


# ============================================================================
# CATEGORY G: CAPABILITY QUESTIONS
# ============================================================================

def handle_category_g_query(query: str) -> Dict[str, Any]:
    """Handle Category G: Smart Capability Questions"""
    normalized = normalize_search_text(query).lower()
    
    if any(phrase in normalized for phrase in ["suggest", "recommendation", "recommend"]):
        return {
            "category": "capability",
            "type": "recommendation",
            "response": """## Dataset Recommendations 🎯

**Based on your interests, I can recommend:**
- Related datasets in the same sector
- Complementary datasets for comparison
- Popular datasets in your browsing history
- Trending datasets in your areas of interest

How would you like recommendations?
- By sector (Agriculture, Healthcare, Finance, etc.)
- By data type (time series, geographic, categorical)
- By analysis type (comparative, trend, statistical)
""",
            "quick_actions": [
                {"label": "Recommend by Sector", "action": "recommend_sector"},
                {"label": "Similar Datasets", "action": "similar_datasets"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["best dataset", "which dataset", "for analysis"]):
        return {
            "category": "capability",
            "type": "best_choice",
            "response": """## Find Best Dataset for Your Analysis 📊

**To recommend the best dataset, tell me:**
- What topic are you interested in? (agriculture, health, transport, etc.)
- What type of analysis? (trends, comparisons, statistics)
- Which region/state? (India-wide or specific state)
- What time period? (latest, historical, trends)

Based on this, I can suggest the most relevant datasets.
""",
            "quick_actions": [
                {"label": "Browse by Topic", "action": "browse_topic"},
                {"label": "View Popular Datasets", "action": "view_popular"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["simplify", "beginner", "easy", "explain simple"]):
        return {
            "category": "capability",
            "type": "simplification",
            "response": """## Simplified Explanations 📖

**I can help you understand:**
- What complex datasets mean in simple terms
- How to read statistical tables
- Interpreting charts and visualizations
- Breaking down domain-specific terminology
- Starting your data exploration journey

What dataset would you like explained in simple terms?
""",
            "quick_actions": [
                {"label": "Explain a Specific Dataset", "action": "explain_dataset"},
                {"label": "Beginner's Guide", "action": "beginner_guide"},
            ]
        }
    
    return None


# ============================================================================
# CATEGORY H: ERROR/EDGE CASE HANDLING
# ============================================================================

def handle_category_h_query(query: str) -> Dict[str, Any]:
    """Handle Category H: Error/Edge Case Questions"""
    normalized = normalize_search_text(query).lower()
    
    if any(phrase in normalized for phrase in ["can't find", "cannot find", "not found"]):
        return {
            "category": "error_handling",
            "type": "not_found",
            "response": """## Can't Find a Dataset? 🔍

**Try these approaches:**
1. **Use different keywords** - Try related terms or sector names
2. **Browse by sector** - Navigate through Agriculture, Healthcare, Transport, etc.
3. **Search by state** - Filter datasets by your state of interest
4. **Check related datasets** - Similar datasets might have the data you need
5. **Contact support** - If you think a dataset is missing

**Popular searches:**
- "Show agriculture datasets"
- "Healthcare data for Karnataka"
- "Population statistics"
- "Education statistics by state"
""",
            "quick_actions": [
                {"label": "Browse Sectors", "action": "browse_sectors"},
                {"label": "Advanced Search", "action": "advanced_search"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["incorrect", "wrong", "missing data", "error"]):
        return {
            "category": "error_handling",
            "type": "data_issue",
            "response": """## Report Data Issue 🐛

**If you've found an issue:**
- Data appears incorrect or incomplete
- Missing values or gaps
- Unexpected results

**Please report with:**
- Dataset name
- Specific issue description
- Expected vs actual values
- State/region affected

Our team will investigate and update the data if needed.

_All data is sourced from data.gov.in and maintained by government authorities._
""",
            "quick_actions": [
                {"label": "Report Issue", "action": "report_issue"},
                {"label": "Contact Support", "action": "contact_support"},
            ]
        }
    
    if any(phrase in normalized for phrase in ["not loading", "api not", "api error", "broken"]):
        return {
            "category": "error_handling",
            "type": "technical_issue",
            "response": """## Technical Issue 🔧

**If you're experiencing:**
- Dataset not loading
- API errors
- Visualizations not working
- Download failures

**Try:**
1. Refresh the page
2. Clear browser cache
3. Try a different dataset
4. Use a different browser
5. Contact support if problem persists

Support team can help diagnose the issue.
""",
            "quick_actions": [
                {"label": "Contact Support", "action": "contact_support"},
                {"label": "Try Another Dataset", "action": "try_another_dataset"},
            ]
        }
    
    return None


# ============================================================================
# QUERY CLASSIFICATION AND ROUTING
# ============================================================================

def classify_query_type(query: str) -> str:
    """Classify the query into one of the 8 categories"""
    normalized = normalize_search_text(query).lower()
    
    # Category A: General Platform Questions
    if any(kw in normalized for kw in CATEGORY_A_KEYWORDS):
        return QueryCategory.GENERAL_PLATFORM
    
    # Category B: Dataset Discovery
    if any(kw in normalized for kw in CATEGORY_B_KEYWORDS):
        return QueryCategory.DATASET_DISCOVERY
    
    # Category C: Data Understanding
    if any(kw in normalized for kw in CATEGORY_C_KEYWORDS):
        return QueryCategory.DATA_UNDERSTANDING
    
    # Category D: Data Analysis
    if any(kw in normalized for kw in CATEGORY_D_KEYWORDS):
        return QueryCategory.DATA_ANALYSIS
    
    # Category F: Action-Based
    if any(kw in normalized for kw in CATEGORY_F_KEYWORDS):
        return QueryCategory.ACTION_BASED
    
    # Category G: Capability
    if any(kw in normalized for kw in CATEGORY_G_KEYWORDS):
        return QueryCategory.CAPABILITY
    
    # Category H: Error Handling
    if any(phrase in normalized for phrase in ["error", "problem", "issue", "not working"]):
        return QueryCategory.ERROR_HANDLING
    
    # Category B (Dataset Discovery) - check for sector/state mentions
    if extract_sector_from_query(query) or extract_state_from_query(query):
        return QueryCategory.DATASET_DISCOVERY
    
    # Default to dataset discovery
    return QueryCategory.DATASET_DISCOVERY


def process_enhanced_query(
    query: str,
    sector: Optional[str] = None,
    state: Optional[str] = None,
    dataset: Optional[Dict[str, Any]] = None,
    matches: Optional[List[Dict[str, Any]]] = None,
    total_count: int = 0,
) -> Dict[str, Any]:
    """
    Process query with enhanced category-specific handling
    
    Returns:
        Dictionary with category, response, actions, and metadata
    """
    query_category = classify_query_type(query)
    
    if query_category == QueryCategory.GENERAL_PLATFORM:
        result = handle_category_a_query(query)
        if result:
            return result
    
    elif query_category == QueryCategory.DATASET_DISCOVERY:
        matches = matches or []
        return handle_category_b_query(query, matches, total_count)
    
    elif query_category == QueryCategory.DATA_UNDERSTANDING:
        if dataset:
            return handle_category_c_query(query, dataset)
    
    elif query_category == QueryCategory.DATA_ANALYSIS:
        if dataset:
            return handle_category_d_query(query, dataset)
    
    elif query_category == QueryCategory.ACTION_BASED:
        if dataset:
            result = handle_category_f_query(query, dataset)
            if result:
                return result
    
    elif query_category == QueryCategory.CAPABILITY:
        result = handle_category_g_query(query)
        if result:
            return result
    
    elif query_category == QueryCategory.ERROR_HANDLING:
        result = handle_category_h_query(query)
        if result:
            return result
    
    # Default response
    return {
        "category": "unknown",
        "response": "I can help you with dataset-related questions. Please try asking about specific datasets or sectors.",
        "quick_actions": []
    }


# ============================================================================
# UTILITY: Format response for frontend
# ============================================================================

def format_enhanced_response(
    session_id: str,
    enhanced_result: Dict[str, Any],
    matches: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Format enhanced result for API response"""
    from app.services.rag_chatbot_service import _session_history
    
    return {
        "sessionId": session_id,
        "restricted": False,
        "content": enhanced_result.get("response", ""),
        "category": enhanced_result.get("category", "unknown"),
        "matches": [
            {
                "id": m.get("id"),
                "title": m.get("title"),
                "description": m.get("description", "")[:200],
                "sector": m.get("sector"),
                "sourceUrl": m.get("sourceUrl"),
                "rank": i + 1,
                "openDatasetButton": {
                    "label": "Open Dataset",
                    "action": f"open_dataset:{m.get('id')}"
                }
            }
            for i, m in enumerate(matches or [])
        ],
        "quick_actions": enhanced_result.get("quick_actions", []),
        "insights": enhanced_result.get("insights", []),
        "result": enhanced_result.get("result"),
        "history": _session_history.get(session_id, []),
    }
