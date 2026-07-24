# docker-images

General Docker Desktop overview — all containers (running/stopped) and local images, not just the MC home-stack ones (see [minecraft-server](../minecraft-server/README.md) for that specific stack's status + controls).

## Status: 🟢 active

## How it works

Shells out to `docker images --format {{json .}}` and `docker ps -a --format {{json .}}`. If the Docker Desktop daemon isn't running (common — it doesn't need to run all the time), the tile shows a **LAUNCH DOCKER DESKTOP** button instead of erroring.

Each running container gets a **LOGS** button (`docker logs --tail 100 <name>`) that opens a scrollable overlay panel — no need to switch to a terminal for a quick look.
