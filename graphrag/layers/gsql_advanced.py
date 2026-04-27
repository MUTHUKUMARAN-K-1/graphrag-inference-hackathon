"""
Advanced GSQL Queries for GraphRAG Novelties
=============================================
Queries that run inside TigerGraph for PPR, paths, and community detection.
Install once via: graph.install_advanced_queries()
"""

# ── Personalized PageRank (CatRAG-inspired) ──────────────
PPR_QUERY = """
CREATE OR REPLACE QUERY pprFromSeeds(
    SET<STRING> seedEntityIds,
    FLOAT damping,
    INT maxIter
) FOR GRAPH {graphname} {{

    TYPEDEF TUPLE<STRING entity_id, STRING name, DOUBLE score> EntityPPR;
    HeapAccum<EntityPPR>(50, score DESC) @@topEntities;
    SumAccum<DOUBLE> @score;
    SumAccum<DOUBLE> @newScore;
    SumAccum<INT> @outDegree;

    # Initialize
    AllEntities = {{Entity.*}};
    AllEntities = SELECT e FROM AllEntities:e
        ACCUM e.@outDegree += 1;

    Seeds = SELECT e FROM AllEntities:e
        WHERE e.entity_id IN seedEntityIds
        ACCUM e.@score += 1.0 / seedEntityIds.size();

    # Power iteration
    FOREACH iter IN RANGE[1, maxIter] DO
        AllEntities = SELECT e FROM AllEntities:e -(RELATED_TO:rel)- Entity:nbr
            ACCUM
                DOUBLE contribution = CASE WHEN nbr.@outDegree > 0
                    THEN nbr.@score * damping * rel.weight / nbr.@outDegree
                    ELSE 0.0 END,
                e.@newScore += contribution
            POST-ACCUM
                e.@score = e.@newScore + CASE WHEN e.entity_id IN seedEntityIds
                    THEN (1.0 - damping) / seedEntityIds.size()
                    ELSE 0.0 END,
                e.@newScore = 0;
    END;

    # Collect top entities by PPR score
    AllEntities = SELECT e FROM AllEntities:e
        WHERE e.@score > 0.001
        ACCUM @@topEntities += EntityPPR(e.entity_id, e.name, e.@score);

    PRINT @@topEntities;
}}

INSTALL QUERY pprFromSeeds
"""

# ── Shortest Path Between Entity Pairs ───────────────────
SHORTEST_PATH_QUERY = """
CREATE OR REPLACE QUERY findReasoningPaths(
    STRING sourceId,
    STRING targetId,
    INT maxDepth
) FOR GRAPH {graphname} {{

    ListAccum<STRING> @pathTrace;
    SetAccum<STRING> @@visitedNodes;
    ListAccum<STRING> @@pathDescriptions;

    Source = {{Entity.*}};
    Source = SELECT e FROM Source:e WHERE e.entity_id == sourceId
        ACCUM e.@pathTrace += e.name;

    FOREACH depth IN RANGE[1, maxDepth] DO
        Source = SELECT nbr FROM Source:e -(RELATED_TO:rel)- Entity:nbr
            WHERE nbr.entity_id NOT IN @@visitedNodes
            ACCUM
                nbr.@pathTrace += e.@pathTrace,
                nbr.@pathTrace += (" -[" + rel.relation_type + "]-> " + nbr.name),
                @@visitedNodes += nbr.entity_id;

        # Check if target reached
        Target = SELECT e FROM Source:e WHERE e.entity_id == targetId
            ACCUM @@pathDescriptions += e.@pathTrace;
    END;

    PRINT @@pathDescriptions;
}}

INSTALL QUERY findReasoningPaths
"""

# ── Spreading Activation ─────────────────────────────────
SPREADING_ACTIVATION_QUERY = """
CREATE OR REPLACE QUERY spreadingActivation(
    SET<STRING> seedEntityIds,
    FLOAT decayFactor,
    INT maxSteps,
    FLOAT threshold
) FOR GRAPH {graphname} {{

    TYPEDEF TUPLE<STRING entity_id, STRING name, DOUBLE activation> ActivatedEntity;
    HeapAccum<ActivatedEntity>(100, activation DESC) @@activated;
    SumAccum<DOUBLE> @activation;
    SumAccum<DOUBLE> @newActivation;

    # Initialize seeds
    Seeds = {{Entity.*}};
    Seeds = SELECT e FROM Seeds:e
        WHERE e.entity_id IN seedEntityIds
        ACCUM e.@activation += 1.0;

    # Propagate
    FOREACH step IN RANGE[1, maxSteps] DO
        ActiveNodes = SELECT e FROM Seeds:e -(RELATED_TO:rel)- Entity:nbr
            WHERE e.@activation > threshold
            ACCUM
                DOUBLE spread = e.@activation * rel.weight * decayFactor,
                nbr.@newActivation += CASE WHEN spread > threshold THEN spread ELSE 0.0 END
            POST-ACCUM
                e.@activation = e.@newActivation,
                e.@newActivation = 0;
    END;

    # Collect all activated entities
    AllEntities = {{Entity.*}};
    AllEntities = SELECT e FROM AllEntities:e
        WHERE e.@activation > threshold
        ACCUM @@activated += ActivatedEntity(e.entity_id, e.name, e.@activation);

    PRINT @@activated;
}}

INSTALL QUERY spreadingActivation
"""

# ── Get Entity Neighborhood for Community Detection ──────
ENTITY_NEIGHBORHOOD_QUERY = """
CREATE OR REPLACE QUERY getEntityNeighborhood(
    SET<STRING> entityIds,
    INT hops
) FOR GRAPH {graphname} {{

    SetAccum<STRING> @@nodeIds;
    SetAccum<STRING> @@edgeDescriptions;
    SumAccum<INT> @@nodeCount;
    SumAccum<INT> @@edgeCount;

    Seeds = {{Entity.*}};
    Seeds = SELECT e FROM Seeds:e WHERE e.entity_id IN entityIds
        ACCUM @@nodeIds += e.entity_id, @@nodeCount += 1;

    FOREACH hop IN RANGE[1, hops] DO
        Seeds = SELECT nbr FROM Seeds:e -(RELATED_TO:rel)- Entity:nbr
            WHERE nbr.entity_id NOT IN @@nodeIds
            ACCUM
                @@nodeIds += nbr.entity_id,
                @@nodeCount += 1,
                @@edgeCount += 1,
                @@edgeDescriptions += (e.name + "|" + rel.relation_type + "|" + nbr.name + "|" + to_string(rel.weight));
    END;

    PRINT @@nodeIds, @@edgeDescriptions, @@nodeCount, @@edgeCount;
}}

INSTALL QUERY getEntityNeighborhood
"""

ALL_ADVANCED_QUERIES = {
    "pprFromSeeds": PPR_QUERY,
    "findReasoningPaths": SHORTEST_PATH_QUERY,
    "spreadingActivation": SPREADING_ACTIVATION_QUERY,
    "getEntityNeighborhood": ENTITY_NEIGHBORHOOD_QUERY,
}
