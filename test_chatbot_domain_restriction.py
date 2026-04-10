"""
Test suite for Chatbot Domain Restriction Enhancement
Tests the is_platform_query() and classify_query_category() functions
"""

import sys
import os

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.rag_chatbot_service import (
    is_platform_query,
    classify_query_category,
    domain_restricted_response,
)


class TestDomainRestriction:
    """Test suite for domain restriction functionality"""

    def test_allowed_general_platform_questions(self):
        """Test Category A: General Platform Questions"""
        allowed_queries = [
            "What is Intelligent Data Hub?",
            "What kind of data is available?",
            "How can I use this platform?",
            "Is the data real-time or static?",
            "Where is this data coming from?",
            "Is this platform free to use?",
            "How reliable is the data?",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            category = classify_query_category(query)
            assert result, f"Query should be allowed: {query}"
            assert category == "general_platform", f"Should classify as platform: {query}"
            print(f"[PASS] General Platform: {query}")

    def test_allowed_dataset_discovery_questions(self):
        """Test Category B: Dataset Discovery Questions"""
        allowed_queries = [
            "Show datasets related to agriculture",
            "What datasets are available in healthcare?",
            "Give me population data for India",
            "What are the latest datasets uploaded?",
            "Filter datasets by state or year",
            "Show datasets with highest usage",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query should be allowed: {query}"
            print(f"✓[PASS] - Dataset Discovery: {query}")

    def test_allowed_data_understanding_questions(self):
        """Test Category C: Data Understanding Questions"""
        allowed_queries = [
            "What does this dataset represent?",
            "Explain this dataset in simple terms",
            "What are the columns in this dataset?",
            "What does this field mean?",
            "What is the source of this dataset?",
            "When was this data last updated?",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query should be allowed: {query}"
            print(f"✓[PASS] - Data Understanding: {query}")

    def test_allowed_data_analysis_questions(self):
        """Test Category D: Data Analysis Questions"""
        allowed_queries = [
            "What trends can you find in this dataset?",
            "Show summary of this dataset",
            "What is the average value?",
            "Compare data between two years",
            "Show top 5 states based on this data",
            "Identify any patterns or anomalies",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query should be allowed: {query}"
            print(f"✓[PASS] - Data Analysis: {query}")

    def test_allowed_sector_specific_questions(self):
        """Test Category E: Sector-Specific Questions"""
        allowed_queries = [
            "Crop production in last 5 years",
            "Which state has highest yield?",
            "Disease statistics in India",
            "Vaccination data trends",
            "Traffic density data",
            "Road accidents statistics",
            "Government expenditure data",
            "GDP trends",
            "Literacy rate by state",
            "School enrollment statistics",
            "Population growth trends",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            category = classify_query_category(query)
            assert result, f"Query should be allowed: {query}"
            assert category in ["sector_specific", "data_analysis"], f"Should classify correctly: {query}"
            print(f"✓[PASS] - Sector Specific: {query}")

    def test_allowed_action_queries(self):
        """Test Category F: Action-Based Questions"""
        allowed_queries = [
            "Download this dataset",
            "Visualize this data",
            "Show charts and graphs",
            "Export data as CSV",
            "Save this dataset",
            "Recommend similar datasets",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query should be allowed: {query}"
            print(f"✓[PASS] - Action-Based: {query}")

    def test_allowed_capability_questions(self):
        """Test Category G: Smart Capability Questions"""
        allowed_queries = [
            "Suggest datasets based on my interest",
            "Explain insights from this dataset",
            "What conclusions can be drawn?",
            "Which dataset is best for analysis on education?",
            "Can you simplify this data for beginners?",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query should be allowed: {query}"
            print(f"✓[PASS] - Capability: {query}")

    def test_allowed_error_queries(self):
        """Test Category H:[ERROR]/Edge Case Questions"""
        allowed_queries = [
            "I can't find a dataset",
            "This data looks incorrect",
            "Why is data missing?",
            "Dataset not loading",
            "API not working",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query should be allowed: {query}"
            print(f"✓[PASS] -[ERROR] Handling: {query}")

    def test_allowed_state_mentions(self):
        """Test queries with state mentions"""
        allowed_queries = [
            "Maharashtra population",
            "Kerala healthcare data",
            "Tamil Nadu agriculture",
            "Delhi population growth",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query with state should be allowed: {query}"
            print(f"✓[PASS] - State Mention: {query}")

    def test_allowed_generic_data_terms(self):
        """Test queries with generic data keywords"""
        allowed_queries = [
            "show me the data",
            "what datasets are there",
            "I want to analyze tables",
            "Show columns in this table",
            "List all datasets",
        ]
        
        for query in allowed_queries:
            result = is_platform_query(query)
            assert result, f"Query with data terms should be allowed: {query}"
            print(f"✓[PASS] - Data Terms: {query}")

    def test_rejected_general_knowledge(self):
        """Test that general knowledge questions are rejected"""
        rejected_queries = [
            "What is the capital of India?",
            "Who is the Prime Minister?",
            "What is the population of the world?",
            "Who wrote Romeo and Juliet?",
        ]
        
        for query in rejected_queries:
            result = is_platform_query(query)
            assert not result, f"Query should be rejected: {query}"
            print(f"✓[PASS] - Rejected (General Knowledge): {query}")

    def test_rejected_off_topic(self):
        """Test that off-topic queries are rejected"""
        rejected_queries = [
            "Tell me a joke",
            "How do I cook pasta?",
            "What's the weather today?",
            "Do you play chess?",
        ]
        
        for query in rejected_queries:
            result = is_platform_query(query)
            assert not result, f"Query should be rejected: {query}"
            print(f"✓[PASS] - Rejected (Off-Topic): {query}")

    def test_rejected_personal_advice(self):
        """Test that personal advice queries are rejected"""
        rejected_queries = [
            "How do I lose weight?",
            "What career should I choose?",
            "How do I improve my relationship?",
            "Should I invest in stocks?",
        ]
        
        for query in rejected_queries:
            result = is_platform_query(query)
            assert not result, f"Query should be rejected: {query}"
            print(f"✓[PASS] - Rejected (Personal Advice): {query}")

    def test_explicit_sector_override(self):
        """Test that explicit sector parameter allows queries"""
        ambiguous_query = "tell me"
        
        # Without sector: should be rejected
        result = is_platform_query(ambiguous_query)
        assert not result, "Ambiguous query should be rejected without sector"
        
        # With sector: should be allowed
        result = is_platform_query(ambiguous_query, sector="agriculture")
        assert result, "Query should be allowed when sector is provided"
        print(f"✓[PASS] - Explicit sector override")

    def test_query_normalization(self):
        """Test that queries are properly normalized"""
        equivalent_queries = [
            ("WHAT IS IDH?", "what is idh?"),
            ("SHOW  DATASETS   IN   AGRICULTURE", "show datasets in agriculture"),
            ("Dataset\nAnalysis", "dataset analysis"),
        ]
        
        for query1, query2 in equivalent_queries:
            result1 = is_platform_query(query1)
            result2 = is_platform_query(query2)
            assert result1 == result2, f"Normalized queries should have same result: {query1} vs {query2}"
            print(f"✓[PASS] - Query normalization")

    def test_response_structure(self):
        """Test that domain_restricted_response returns proper structure"""
        response = domain_restricted_response("test-session", "arbitrary query")
        
        assert "sessionId" in response
        assert response["restricted"] is True
        assert "content" in response
        assert isinstance(response.get("matches"), list)
        assert len(response.get("matches", [])) == 0
        assert isinstance(response.get("insights"), list)
        print(f"✓[PASS] - Response structure validation")


def run_all_tests():
    """Run all tests"""
    test_suite = TestDomainRestriction()
    
    print("\n" + "="*70)
    print("RUNNING CHATBOT DOMAIN RESTRICTION TEST SUITE")
    print("="*70 + "\n")
    
    test_methods = [
        method for method in dir(test_suite)
        if method.startswith("test_") and callable(getattr(test_suite, method))
    ]
    
    total_tests = len(test_methods)
    passed_tests = 0
    failed_tests = 0
    
    for method_name in sorted(test_methods):
        print(f"\n[{method_name}]")
        try:
            method = getattr(test_suite, method_name)
            method()
            passed_tests += 1
        except AssertionError as e:
            print(f"[FAIL] - {e}")
            failed_tests += 1
        except Exception as e:
            print(f"[ERROR] - {e}")
            failed_tests += 1
    
    print("\n" + "="*70)
    print(f"TEST RESULTS: {passed_tests} passed, {failed_tests} failed out of {total_tests}")
    print("="*70 + "\n")
    
    return failed_tests == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
