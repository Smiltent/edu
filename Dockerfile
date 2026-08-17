FROM denoland/deno:latest
WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY deno.json deno.lock* ./

RUN deno install

COPY . .
EXPOSE 3000

CMD ["deno", "task", "start"]
