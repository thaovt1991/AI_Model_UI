// Jenkins Declarative Pipeline — build Angular AI_Model_UI
// Yêu cầu Jenkins agent: Node.js 20+ (khuyến nghị LTS), npm 10+
pipeline {
    agent any

    tools {
        // Tên tool khai báo trong Jenkins: Manage Jenkins → Tools → NodeJS installations
        // Đặt tên trùng "NodeJS-20" hoặc sửa lại cho khớp môi trường của bạn
        nodejs 'NodeJS-20'
    }

    parameters {
        string(
            name: 'API_BASE_URL',
            defaultValue: 'http://localhost:5296/api/ai',
            description: 'URL Backend API — ghi vào environment.ts trước khi build'
        )
        choice(
            name: 'BUILD_CONFIG',
            choices: ['production', 'development'],
            description: 'Cấu hình Angular build'
        )
    }

    environment {
        APP_DIR = 'AI_Model_UI'
        DIST_DIR = 'dist/AI_Model_UI'
        CI = 'true'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                dir(env.APP_DIR) {
                    sh 'node -v'
                    sh 'npm -v'
                    // npm ci: cài đúng version trong package-lock.json — phù hợp CI
                    sh 'npm ci'
                }
            }
        }

        stage('Configure API URL') {
            steps {
                dir(env.APP_DIR) {
                    sh """
                        sed -i "s|apiBaseUrl:.*|apiBaseUrl: '${params.API_BASE_URL}',|" src/environments/environment.ts
                        echo '--- environment.ts sau khi cấu hình ---'
                        cat src/environments/environment.ts
                    """
                }
            }
        }

        stage('Build Angular') {
            steps {
                dir(env.APP_DIR) {
                    sh "npm run build -- --configuration=${params.BUILD_CONFIG}"
                }
            }
        }

        stage('Archive artifact') {
            steps {
                dir(env.APP_DIR) {
                    archiveArtifacts artifacts: "${env.DIST_DIR}/**/*", fingerprint: true
                }
            }
        }
    }

    post {
        success {
            echo "Build UI thành công. Artifact: ${env.APP_DIR}/${env.DIST_DIR}"
        }
        failure {
            echo 'Build UI thất bại — xem log stage Install / Build.'
        }
        always {
            cleanWs(deleteDirs: true, patterns: [[pattern: '**/node_modules', type: 'INCLUDE']])
        }
    }
}
