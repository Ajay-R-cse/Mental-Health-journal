# Build Stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source code and build package
COPY src ./src
RUN mvn clean package -DskipTests

# Production Stage with Eclipse Temurin JRE 17
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy artifact from build stage
COPY --from=build /app/target/java-nlp-service-1.0.0.jar app.jar

# Cloud Run dynamic port handling (defaults to 8080 if not set by container environment)
ENV PORT=8080
ENV JAVA_OPTS="-Xmx2048m -Xms512m -XX:+UseG1GC"

EXPOSE 8080

# Execute Spring Boot microservice with memory tuning for CoreNLP models
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar --server.port=${PORT}"]
