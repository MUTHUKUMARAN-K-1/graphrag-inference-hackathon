"""
Setup script for TigerGraph — Run this once to initialize the graph database.
Creates schema (Document, Chunk, Entity, Community vertices + edges)
and installs GSQL queries (vector search, entity search, graph traversal).
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def setup_tigergraph():
    """One-time TigerGraph setup: create schema and install queries."""
    from graphrag.layers.graph_layer import GraphLayer

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

    logger.info("Installing GSQL queries...")
    results = graph.install_queries()
    for name, status in results.items():
        logger.info(f"  {name}: {status}")

    logger.info("✅ TigerGraph setup complete!")
    return True


if __name__ == "__main__":
    setup_tigergraph()
