precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D uSampler;
uniform float uIntensity;
uniform float uSmoothness;

void main() {
    vec4 color = texture2D(uSampler, v_texCoord);
    
    // Calcula a distância do centro (0.5, 0.5)
    float dist = distance(v_texCoord, vec2(0.5, 0.5));
    
    // Aplica a vinheta baseada na distância
    float vignette = smoothstep(uIntensity, uIntensity - uSmoothness, dist);
    
    gl_FragColor = vec4(color.rgb * vignette, color.a);
}
