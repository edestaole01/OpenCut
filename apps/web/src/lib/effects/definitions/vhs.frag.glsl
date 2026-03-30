precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uAmount;

// Função simples de ruído pseudo-aleatório
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    float time = uTime * 0.5;
    
    // Deslocamento horizontal aleatório baseado no tempo (glitch de linha)
    float lineNoise = step(0.98, rand(vec2(time, v_texCoord.y))) * 0.02 * uAmount;
    
    // RGB Split: cada canal lê de uma coordenada ligeiramente diferente
    float offset = 0.01 * uAmount;
    float r = texture2D(uSampler, vec2(v_texCoord.x + offset + lineNoise, v_texCoord.y)).r;
    float g = texture2D(uSampler, vec2(v_texCoord.x + lineNoise, v_texCoord.y)).g;
    float b = texture2D(uSampler, vec2(v_texCoord.x - offset + lineNoise, v_texCoord.y)).b;
    
    vec3 color = vec3(r, g, b);
    
    // Adiciona um pouco de ruído estático (grão)
    float staticNoise = rand(v_texCoord + time) * 0.05 * uAmount;
    color += staticNoise;
    
    gl_FragColor = vec4(color, 1.0);
}
