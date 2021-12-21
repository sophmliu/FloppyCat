import { tiny } from './common.js';
const { vec3, vec, Shape } = tiny;

// builds a 2D trail from points defining the edges of segments
export class Trail_Shape extends Shape {
    constructor(segment_coords, height = 1.0) {
        super("position", "normal", "texture_coord");

        let bottom_vertex = vec3(segment_coords[0][0], segment_coords[0][1] - height / 2, segment_coords[0][2]);
        let top_vertex = vec3(segment_coords[0][0], segment_coords[0][1] + height / 2, segment_coords[0][2]);
        this.arrays.position.push(bottom_vertex, top_vertex);
        this.arrays.normal.push(vec3(0, 0, 1), vec3(0, 0, 1));
        this.arrays.texture_coord.push(vec(0, 0), vec(0, 1));

        this.height = height;

        const segment_count = segment_coords.length;
        for (let i = 1; i < segment_count; i++) {
            const x = segment_coords[i][0];
            const y = segment_coords[i][1];
            const z = segment_coords[i][2];
            bottom_vertex = vec3(x, y - height / 2, z);
            top_vertex = vec3(x, y + height / 2, z);

            this.arrays.position.push(bottom_vertex, top_vertex);
            this.arrays.normal.push(vec3(0, 0, 1), vec3(0, 0, 1));
            this.arrays.texture_coord.push(vec(0, 0), vec(0, 1));

            this.indices.push((i - 1) * 2 + 1, (i - 1) * 2, i * 2 + 1, (i - 1) * 2, i * 2, i * 2 + 1);
        }
    }

    update_segment_coords(new_coords) {
        if (new_coords.length != this.arrays.position.length / 2) {
            throw "Error: " + new_coords.length + " coordinates provided to trail (needs " + this.arrays.position.length + ")";
        }

        const position = [];
        for (let i = 0; i < new_coords.length; i++) {
            const x = new_coords[i][0];
            const y = new_coords[i][1];
            const z = new_coords[i][2];
            position.push(vec3(x, y - this.height / 2, z), vec3(x, y + this.height / 2, z));
        }

        this.arrays.position = position;
        this.set_needs_gpu_update("position");
    }
}