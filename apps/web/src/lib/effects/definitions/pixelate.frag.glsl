precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D uSampler;
uniform float uPixelSize;
uniform vec2 uResolution;

void main() {
    // Calcula o tamanho do pixel em relação à resolução
    float dx = uPixelSize / uResolution.x;
    float dy = uPixelSize / uResolution.y;
    
    // Arredonda a coordenada para o centro do pixel mais próximo
    vec2 coord = vec2(dx * floor(v_texCoord.x / dx),
                      dy * floor(v_texCoord.y / dy));
    
    gl_FragColor = texture2D(uSampler, coord);
}
