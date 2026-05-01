"""
Setup script for TigerGraph — Run this once to initialize the graph database.
Creates schema (Document, Chunk, Entity, Community vertices + edges)
and installs all GSQL queries (basic + advanced novelty queries).
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def setup_tigergraph():
    """One-time TigerGraph setup: create schema and install all queries."""
    from graphrag.layers.graph_layer import GraphLayer
    from graphrag.layers.gsql_advanced import ALL_ADVANCED_QUERIES

    config = {
        "host": os.getenv("TG_HOST", ""),
        "graphname": os.getenv("TG_GRAPH", "GraphRAG"),
        "username": os.getenv("TG_USERNAME", "tigergraph"),
        "password": os.getenv("TG_PASSWORD", ""),
    }

    if not config["host"]:
        logger.error("TG_HOST not set. Please set environment variables.")
        logger.info("Required: TG_HOST, TG_PASSWORD")
        logger.info("Optional: TG_GRAPH (default: GraphRAG), TG_USERNAME (default: tigergraph)")
        sys.exit(1)

    graph = GraphLayer(config=config)

    logger.info("Connecting to TigerGraph Cloud...")
    if not graph.connect():
        logger.error("Connection failed. Check your credentials.")
        sys.exit(1)

    logger.info("Creating graph schema...")
    result = graph.create_schema()
    logger.info(f"Schema result: {result}")

    logger.info("Installing core GSQL queries (vector search, entity search, traversal)...")
    results = graph.install_queries()
    for name, status in results.items():
        logger.info(f"  {name}: {status}")

    logger.info("Installing advanced GSQL queries (PPR, paths, spreading activation, neighborhood)...")
    gn = config.get("graphname", "GraphRAG")
    for name, query_template in ALL_ADVANCED_QUERIES.items():
        try:
            result = graph.conn.gsql(query_template.format(graphname=gn))
            logger.info(f"  {name}: {result}")
        except Exception as e:
            logger.warning(f"  {name}: FAILED — {e}")

    logger.info("✅ TigerGraph setup complete! All queries installed.")
    return True


if __name__ == "__main__":
    setup_tigergraph()
