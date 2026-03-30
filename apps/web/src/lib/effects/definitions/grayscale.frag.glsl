precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D uSampler;
uniform float uIntensity;

void main() {
    vec4 color = texture2D(uSampler, v_texCoord);
    
    // Luminância média baseada nos canais RGB
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    
    // Mistura com a cor original baseada na intensidade
    gl_FragColor = vec4(mix(color.rgb, vec3(gray), uIntensity), color.a);
}
