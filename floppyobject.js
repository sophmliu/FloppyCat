import { defs, tiny } from './util/common.js';
import { Shape_From_File } from './util/obj-file.js';
import { Trail_Shape } from './util/trail.js';
import { Text_Line } from './util/text.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Textured_Phong} = defs;

//var scene_background_color = color(.40, .71, .83, 1); //default scene background
class GameState {
    static Playing = new GameState("PLAYING");
    static Reset = new GameState("RESET");

    constructor(name) {
        this.name = name;
    }
}

export class FloppyObject extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.config = {
            RAINBOW_SEGMENTS: 40,
            MAX_PIPE_MIDPOINT: 1.5,
            MIN_PIPE_MIDPOINT: -1.5,
            PIPE_SEPARATION_X: 5.0,
            PIPE_SEPARATION_Y: 1.5,
            SPEED: 2.0,
        };

        this.state = null;
        this.fpv = 0;

        this.score = 0.0;
        this.high_score = 0.0;
        this.distance = 0.0; // how far we've moved
        this.delta_distance = 0.0;
        this.nightlight_threshold = Math.random();
        this.color_mode = 0;
        this.time_of_day = 0;
        this.floppyobject_transform = Mat4.identity().times(Mat4.translation(-5, 0, 10))
            .times(Mat4.scale(1, 1, -1));
        this.rainbow_segment_coords = Array(this.config.RAINBOW_SEGMENTS).fill(vec4(0, 0, 0, 0));

        this.floppy_velocity = vec(0, 0);

        this.sounds = {
            jump: new Audio("./assets/jump.m4a"),
            fall: new Audio("./assets/falling.m4a"),
            crash: new Audio("./assets/crash.m4a"),
            point: new Audio("./assets/point.m4a"),
            song: new Audio("./assets/song.m4a")
        }
        this.sounds.song.loop = true;

        for (const [_, sound] of Object.entries(this.sounds)) {
            sound.preload = "auto";
        }

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            axes: new defs.Axis_Arrows(),
            sphere: new defs.Subdivision_Sphere(4),
            cube: new defs.Cube,
            circle: new defs.Regular_2D_Polygon(1, 15),
            square: new defs.Square,
            triangle: new defs.Triangle,
            star: new defs.Star,
            sphere2: new defs.Subdivision_Sphere(1),
            sphere3: new defs.Subdivision_Sphere(2),
            sphere4: new defs.Subdivision_Sphere(3),
            sphere5: new defs.Subdivision_Sphere(4),
            pipe: new Shape_From_File("./assets/pipe_geometry.obj"),
            nyan_cat: new Shape_From_File("./assets/nyancat_geometry.obj"),
            rainbow_trail: new Trail_Shape(this.rainbow_segment_coords, 0.9),
            cone: new defs.Cone_Tip(15, 15),
            text: new Text_Line(35),
        };

        const texture = new defs.Textured_Phong(1);
        // *** Materials
        this.materials = {
            axes: new Material(new defs.Fake_Bump_Map(), {
                color: color(0, 0, 0, 1), ambient: 1,
                texture: new Texture("assets/rgb.jpg")
            }),
            cloud: new Material(new defs.Phong_Shader(),
                { ambient: 1, diffusivity: 1, color: color(1, 1, 1, .4) }),
            pipe: new Material(new defs.Phong_Shader(),
                { ambient: .4, diffusivity: 0.8, specularity: 0.8, color: hex_color("#2CB01A") }),
            nyan_cat: new Material(new defs.Textured_Phong(), {
                ambient: 1.0, diffusivity: 1.0, specularity: 0.0, color: color(0, 0, 0, 1),
                texture: new Texture("assets/nyancat.jpg")
            }),
            frosting: new Material(new defs.Phong_Shader(),
                { ambient: 1.0, diffusivity: 1, specularity: 0.5, color: hex_color("#C87DC0") }),
            brick: new Material(new defs.Phong_Shader(),
                { ambient: 0.7, diffusivity: 0.3, specularity: 0, color: hex_color("#ab5930") }),
            brickdetails: new Material(new defs.Phong_Shader(),
                { ambient: 0.7, diffusivity: 0.3, specularity: 0, color: hex_color("#f0d292") }),
            windows: new Material(new defs.Phong_Shader(),
                { ambient: 0.7, diffusivity: 0.3, specularity: 0, color: hex_color("#bfc3c7") }),

            changing_background: new Material(new Changing_Background(),{
                color: hex_color("#000000"),
                ambient: 1, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/rainbow.jpg", "NEAREST")
             }),
            stars: new Material(new defs.Phong_Shader(),
                { ambient: 1.0, diffusivity: 1.0, specularity: 0.0, color: hex_color("#F1E722") }),
            rainbow: new Material(new defs.Textured_Phong(), {
                ambient: 1.0, diffusivity: 0.0, specularity: 0, color: hex_color("#000000"),
                texture: new Texture("assets/rainbow.jpg")
            }),

            night_sky: new Material(new defs.Phong_Shader(),
                { ambient: .2, diffusivity: 0, specularity: 0, color: hex_color("#0F4B87") }),
            grey: new Material(new defs.Phong_Shader(),
                { ambient: 0, diffusivity: .3, specularity: .5, color: color(.5, .5, .5, 1) }),
            start: new Material(new defs.Phong_Shader(),
                { ambient: 1, diffusivity: .3, specularity: .5, color: color(0, 0, 0, .998) }),
            text_image: new Material(texture, {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),

        }
        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        //this.initial_camera_location = Mat4.translation(-10,this.floppyobject_transform[1][3],16,1).times(Mat4.look_at(vec3(-20,0,0), vec3(0,0,0), vec3(0,1,0)));
        this.set_state(GameState.Reset);
    }

    set_state(state) {
        this.state = state;
        if (state === GameState.Reset) {
            this.sounds.song.pause();
            this.sounds.song.currentTime = 0;
            this.reset_game();
        } else if (state === GameState.Playing) {
            this.sounds.song.play();
        }
    }

    reset_game() {
        if (this.score > this.high_score)
            this.high_score = this.score;
        this.score = 0;
        this.distance = 0;
        this.delta_distance = 0;
        this.floppyobject_transform = Mat4.identity().times(Mat4.translation(-5, 0, 10))
            .times(Mat4.scale(1, 1, -1));

        this.floppy_velocity = vec3(0, 0, 0);

        console.log(this.floppyobject_transform);
        const init_rainbow_coord = vec3(this.floppyobject_transform[0][3], this.floppyobject_transform[1][3], this.floppyobject_transform[2][3]);
        console.log(init_rainbow_coord);
        this.rainbow_segment_coords = Array(this.config.RAINBOW_SEGMENTS).fill(init_rainbow_coord);
        this.pipe_xs = Array.from({ length: 10 }, () => 0);
        this.pipe_ys = Array.from({ length: 10 }, () => this.gen_pipe_y())
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Jump", ["j"], this.trigger_jump);
        this.key_triggered_button("Restart", ["r"], this.reset_game);
        this.new_line();
        this.key_triggered_button("Change Color", ["c"], this.create_new_scene_color);
        //this.key_triggered_button("Change Time of Day", ["t"], this.change_time_of_day);
        this.key_triggered_button("First Person Mode", ["f"], () => {
            this.fpv ^= 1;
        });
    }

    trigger_jump() {
        this.floppy_velocity = vec3(0, 3, 0);
        this.sounds.jump.play();

        if (this.state === GameState.Reset) {
            this.set_state(GameState.Playing);
        }
    }

    cloud_x_pos(time) {
        var xPos;
        xPos = 1.25 * time;
        return xPos;
    }

    draw_sky(context, program_state) {
        const t = program_state.animation_time / 1000;
        //draws 100 clouds and resets position when out of boundary
        let model_transform = Mat4.identity();
        var xPosition = -this.cloud_x_pos(t);

       /* if (!this.cloud_ys) {
            this.cloud_ys = Array.from({ length: 100 }, () => (Math.random() * (1.5)) + 4);
        }

         if (t%45 < 6 || t%45 > 39) { //daytime
            for (var i = 100; i > 0; i--) {

                if (xPosition <= -100)
                    xPosition += 80;


                model_transform = Mat4.identity().times(Mat4.translation(10 * i, 0, 0));
                model_transform = model_transform.times(Mat4.scale(1.35, 1.35, 1).times(Mat4.translation(xPosition, this.cloud_ys[i], 0))); //x value should vary
                this.shapes.sphere5.draw(context, program_state, model_transform, this.materials.cloud);

                model_transform = model_transform.times(Mat4.scale(.74, .9, 1));
                this.shapes.sphere5.draw(context, program_state, model_transform.times(Mat4.translation(-1, 0, 0)), this.materials.cloud);
                this.shapes.sphere5.draw(context, program_state, model_transform.times(Mat4.translation(1, 0, 0)), this.materials.cloud);

                model_transform = model_transform.times(Mat4.scale(.74, .65, 1));
                this.shapes.sphere5.draw(context, program_state, model_transform.times(Mat4.translation(-2, 0, 0)), this.materials.cloud);
                this.shapes.sphere5.draw(context, program_state, model_transform.times(Mat4.translation(2, 0, 0)), this.materials.cloud);

            }
        }*/

         if (t%45 > 11.25 && t%45 < 25.5){ //Nighttime
            for (var j = 0; j !== 10; j++) {
                var scale_change = 0.0625 * Math.cos(Math.PI * t) + 0.0625;
                var color_change = -0.13 * Math.cos(Math.PI * t) + 0.13;
                var star_color = color(.87 + color_change, .87 + color_change, 0.5 * Math.cos(Math.PI * t), 1);
                                let model_transform1 = model_transform.times(Mat4.translation(-15 + (j * 7), 7, 0))
                                                 .times(Mat4.scale(scale_change, scale_change, scale_change)
                                                 .times(Mat4.rotation(5 * scale_change, 0, 0, 1)));

                let model_transform2 = model_transform.times(Mat4.translation(-15 + (j * 12), 3, 0))
                                                 .times(Mat4.scale(scale_change, scale_change, scale_change))
                                                 .times(Mat4.rotation(5 * scale_change, 0, 0, 1));
                this.shapes.star.draw(context, program_state, model_transform1, this.materials.stars.override({ color: star_color }));
                this.shapes.star.draw(context, program_state, model_transform2, this.materials.stars.override({ color: star_color }));

            }
        }
    }

    draw_building(context, program_state, height, width, xPos, color) {
        let model_transform = Mat4.identity();
        let building_transform = model_transform.times(Mat4.translation(xPos, -13, -5))
            .times(Mat4.rotation(Math.PI / 2, 0, 0, 1))
            .times(Mat4.scale(height * 2, width * 2, 1));
        this.shapes.cube.draw(context, program_state, building_transform, this.materials.brick.override({ color: hex_color(color) }));
        let t = program_state.animation_time / 1000;
        if (t%45 > 11.25 && t%45 < 27.5) { //boxes in the scene with dark background squares
            for (var i = 0; i < 7; i++) {
                let window_transform = Mat4.identity()
                    .times(Mat4.translation(xPos, height - 14 - i, -3.85)
                        .times(Mat4.scale(.25, .25, 0)));

                if (this.nightlight_threshold >= .50) { //some lights wont turn on, could add more randomness
                    if (this.nightlight_threshold <= .75) {
                        if (i % 2 == 0)
                            this.shapes.cube.draw(context, program_state, window_transform, this.materials.brick.override({ color: hex_color("#FFF300"), ambient: 1.0, specularity: 0 })); //Make windows at night!
                    }
                    else {
                        if (i % 2 == 1)
                            this.shapes.cube.draw(context, program_state, window_transform, this.materials.brick.override({ color: hex_color("#FFF300"), ambient: 1.0, specularity: 0 })); //Make windows at night!
                    }
                }
                else {
                    if (this.nightlight_threshold <= .25) {
                        if (i % 2 == 1)
                            this.shapes.cube.draw(context, program_state, window_transform, this.materials.brick.override({ color: hex_color("#FFF300"), ambient: 1.0, specularity: 0 })); //Make windows at night!
                    }
                    else {
                        if (i % 2 == 0)
                            this.shapes.cube.draw(context, program_state, window_transform, this.materials.brick.override({ color: hex_color("#FFF300"), ambient: 1.0, specularity: 0 })); //Make windows at night!
                    }
                }
            }

            var behind_building_transform = building_transform.times(Mat4.scale(50, 50, 1)
                .times(Mat4.translation(0, 0, -5)));
            var in_front_transform = Mat4.identity()
                .times(Mat4.translation(50, 0, 0)
                    .times(Mat4.rotation(Math.PI / 2, 0, 1, 0)
                        .times(Mat4.scale(50, 50, 0))));
            var behind_transform = Mat4.identity()
                .times(Mat4.translation(-50, 0, 0)
                    .times(Mat4.rotation(Math.PI / 2, 0, 1, 0)
                        .times(Mat4.scale(50, 50, 0))));
            var top_transform = Mat4.identity()
                .times(Mat4.translation(0, 50, 0)
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)
                        .times(Mat4.scale(50, 50, 0))));
            var bottom_transform = Mat4.identity()
                .times(Mat4.translation(0, -50, 0)
                    .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)
                        .times(Mat4.scale(50, 50, 0))));
            var behind_player_transform = behind_building_transform
                .times(Mat4.translation(0, 0, 50));

            /*this.shapes.square.draw(context, program_state, behind_building_transform, this.materials.night_sky);
            this.shapes.square.draw(context, program_state, in_front_transform, this.materials.night_sky);
            this.shapes.square.draw(context, program_state, behind_transform, this.materials.night_sky);
            this.shapes.square.draw(context, program_state, top_transform, this.materials.night_sky);
            this.shapes.square.draw(context, program_state, bottom_transform, this.materials.night_sky);
            this.shapes.square.draw(context, program_state, behind_player_transform, this.materials.night_sky);*/
        }
    }

    draw_city(context, program_state) {
        this.draw_building(context, program_state, 7, 0.5, -19, "#276da3");
        this.draw_building(context, program_state, 4, 0.8, -16, "#356285");
        this.draw_building(context, program_state, 5, 0.6, -13, "#2c488a");
        this.draw_building(context, program_state, 3, 0.8, -10, "2d3c61");
        this.draw_building(context, program_state, 6, 0.5, -10, "#223s7a");
        this.draw_building(context, program_state, 4, 0.65, -6.5, "#3e5078");
        this.draw_building(context, program_state, 5, 0.6, -4, "#325b7d");
        this.draw_building(context, program_state, 3, 0.8, -2, "#255073");
        this.draw_building(context, program_state, 4, 0.43, 0.5, "#36808f");
        this.draw_building(context, program_state, 5.5, 0.35, 2, "#36738f");
        this.draw_building(context, program_state, 4, 0.5, 3.7, "#20536b");
        this.draw_building(context, program_state, 5, 0.6, 6, "#2e4669");
        this.draw_building(context, program_state, 3, 0.8, 8, "#1a355c");
        this.draw_building(context, program_state, 7, 0.5, 11, "#3d587d");
        this.draw_building(context, program_state, 5.5, 0.35, 13, "#36738f");
        this.draw_building(context, program_state, 4, 0.5, 15, "#20536b");
        this.draw_building(context, program_state, 5, 0.6, 17, "#2e4669");
        this.draw_building(context, program_state, 3, 0.8, 19, "#1a355c");
        this.draw_building(context, program_state, 7, 0.5, 21, "#3d587d");
    }

    draw_axes(context, program_state) {
        this.shapes.axes.draw(context, program_state, Mat4.identity(), this.materials.axes);
    }

    create_new_scene_color() {
        if (this.color_mode + 1 === 5) //max of 5 color modes
            this.color_mode = 0;
        else
            this.color_mode++;
    }

    change_time_of_day() {
        if (this.time_of_day == 0) {

            this.time_of_day = 1;
            this.nightlight_threshold = Math.random();
        }
        else
            this.time_of_day = 0;
    }

    pipe_color_mode(option) {

        var r_rand = Math.random() + .4;
        var g_rand = Math.random() + .4;
        var b_rand = Math.random() + .4;

        if (option === 0) //default green color
            return hex_color("#2CB01A");
        else if (option === 1)
            return hex_color("#F0F0F0");
        else if (option === 2)
            return hex_color("#AF0004");
        else if (option === 3)
            return hex_color("#AA00AA");
        else if (option === 4) //PARTY MODE!
            return color(r_rand, g_rand, b_rand, 1);
    }

    gen_pipe_y() {
        return (Math.random() * (this.config.MAX_PIPE_MIDPOINT - this.config.MIN_PIPE_MIDPOINT)) + this.config.MIN_PIPE_MIDPOINT;
    }

    draw_pipes_and_check_collision(context, program_state) { //TODO: make pipes have bigger uniform gap - changed to 1.75. confirm if better?
        if (!this.pipe_ys) {
            this.pipe_ys = Array.from({ length: 10 }, () => this.gen_pipe_y());
        }
        if (!this.pipe_xs) {
            this.pipe_xs = Array.from({ length: 10 }, () => 0);
        }

        const model_transform = Mat4.translation(0, 0, 10);

        const bottom_pipe_common_transform = Mat4.translation(0, -this.config.PIPE_SEPARATION_Y, 0).times(model_transform); // top of bottom pipe at y=-1
        const top_pipe_common_transform = Mat4.rotation(Math.PI, 0, 0, 1).times(bottom_pipe_common_transform); // bottom of top pipe at y=1

        let did_collide = false;

        // draw pipes
        for (var i = 0; i != 10; i++) {
            const pipe_midpoint = this.pipe_ys[i];
            const pipe_offset_i = i * this.config.PIPE_SEPARATION_X;

            if ((pipe_offset_i - this.distance + this.pipe_xs[i]) <= -25) {
                this.pipe_xs[i] = this.pipe_xs[i] + 50;
                this.pipe_ys[i] = (Math.random() * (this.config.MAX_PIPE_MIDPOINT - this.config.MIN_PIPE_MIDPOINT)) + this.config.MIN_PIPE_MIDPOINT;
            }

            const top_pipe_transform = Mat4.translation(pipe_offset_i - this.distance + this.pipe_xs[i]+3, pipe_midpoint, 0).times(top_pipe_common_transform);
            const bottom_pipe_transform = Mat4.translation(pipe_offset_i - this.distance + this.pipe_xs[i]+3, pipe_midpoint, 0).times(bottom_pipe_common_transform);

            // top pipe
            this.shapes.pipe.draw(
                context,
                program_state,
                top_pipe_transform,
                this.materials.pipe.override({ color: this.pipe_color_mode(this.color_mode) })
            );

            // bottom pipe
            this.shapes.pipe.draw(
                context,
                program_state,
                bottom_pipe_transform,
                this.materials.pipe.override({ color: this.pipe_color_mode(this.color_mode) })
            );

            did_collide = did_collide || this.shapes.pipe.is_colliding_with(this.shapes.nyan_cat, bottom_pipe_transform, this.floppyobject_transform) ||
                this.shapes.pipe.is_colliding_with(this.shapes.nyan_cat, top_pipe_transform, this.floppyobject_transform);
        }

        return did_collide;
    }

    draw_score(context, program_state) {
        let place_model = Mat4.identity();
        place_model = place_model.times(Mat4.translation(5.2, -4.23, 12)).times(Mat4.rotation(1.02, -90, -115, 1));
        if(this.fpv == 1){
            place_model = Mat4.identity().times(Mat4.translation(0,this.floppyobject_transform[1][3]-2.45,12.2,1)).times(Mat4.rotation(3.14,-1,0,1)).times(Mat4.rotation(3.14,0,0,1)).times(Mat4.rotation(.57, -90, -70, 1));
        }
        this.shapes.cube.draw(context, program_state, place_model, this.materials.grey);

        //const funny_orbit = Mat4.rotation(0,0,0,0);

        let string = "\nScore: " + this.score;
        let strings = ["", "", "", "", string, ""];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {             // Find the matrix for a basis located along one of the cube's sides:
                if ((2 * i + j) == 4) {
                    let cube_side = Mat4.rotation(i == 0 ? Math.PI / 2 : 0, 1, 0, 0)
                        .times(Mat4.rotation(Math.PI * j - (i == 1 ? Math.PI / 2 : 0), 0, 1, 0))
                        .times(Mat4.translation(-.9, .9, 1.01));

                    const multi_line_string = strings[2 * i + j].split('\n');
                    // Draw a Text_String for every line in our string, up to 30 lines:
                    for (let line of multi_line_string.slice(0, 30)) {             // Assign the string to Text_String, and then draw it.
                        this.shapes.text.set_string(line, context.context);
                        this.shapes.text.draw(context, program_state, place_model.times(cube_side)
                            .times(Mat4.scale(.11, .11, .11)), this.materials.text_image);
                        // Move our basis down a line.
                        cube_side.post_multiply(Mat4.translation(0, -.06, 0));
                    }
                }
            }
        }
    }

    draw_start_screen(context, program_state) {
        let place_model = Mat4.identity();
        place_model = place_model.times(Mat4.translation(0, 0, 12).times(Mat4.scale(3, 3, .5)));
        if(this.fpv == 1){
            place_model = place_model.times(Mat4.scale(1,.57,3.5)).times(Mat4.translation(1.6,0,-1.15)).times(Mat4.rotation(3.14,-1,0,1)).times(Mat4.rotation(3.14,0,0,1));
        }
        this.shapes.cube.draw(context, program_state, place_model, this.materials.start);


        let string = "\n\nWELCOME TO \n\n\n FLOPPY CAT!\n\n\n\n\n   ^._.^\n\n\n \n\nPRESS J \n\n\n\n TO START!\n\n\n\n\n\n HIGH SCORE:\n\n\n     " + this.high_score;
        let strings = ["", "", "", "", string, ""];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {             // Find the matrix for a basis located along one of the cube's sides:
                if ((2 * i + j) == 4) {
                    let cube_side = Mat4.rotation(i == 0 ? Math.PI / 2 : 0, 1, 0, 0)
                        .times(Mat4.rotation(Math.PI * j - (i == 1 ? Math.PI / 2 : 0), 0, 1, 0))
                        .times(Mat4.translation(-.9, .9, 1.01));

                    const multi_line_string = strings[2 * i + j].split('\n');
                    // Draw a Text_String for every line in our string, up to 30 lines:
                    for (let line of multi_line_string.slice(0, 30)) {             // Assign the string to Text_String, and then draw it.
                        this.shapes.text.set_string(line, context.context);
                        this.shapes.text.draw(context, program_state, place_model.times(cube_side)
                            .times(Mat4.scale(.11, .11, .11)), this.materials.text_image);
                        // Move our basis down a line.
                        cube_side.post_multiply(Mat4.translation(0, -.06, 0));
                    }
                }
            }
        }
    }

    check_bounds() {
        var y_position = this.floppyobject_transform[1][3];
        return y_position > 10 || y_position < -10;
    }


    draw_floppyobject(context, program_state) {
        const dt = program_state.animation_delta_time / 1000;

        const velocity_transform = Mat4.translation(this.floppy_velocity[0] * dt, this.floppy_velocity[1] * dt, 0);
        this.floppyobject_transform = velocity_transform.times(this.floppyobject_transform);

        if (this.state === GameState.Playing) {
            this.floppy_velocity.add_by(vec3(0, -9.81 * dt, 0));
        }

        // don't let flappy cat go beyond the screen
        if (this.floppyobject_transform[3][1] < 0) {
            this.floppy_velocity = vec3(0, 0, 0);
            this.floppyobject_transform = Mat4.identity().times(Mat4.translation(-5, -2, 10));
        }

        this.shapes.nyan_cat.draw(context, program_state, this.floppyobject_transform, this.materials.nyan_cat);

        // update rainbow trail
        const new_pos = this.floppyobject_transform.times(vec4(0, 0, 0, 1));
        const movement_vec = vec4(-this.delta_distance, 0, 0, 0);
        this.rainbow_segment_coords.forEach(v => v.add_by(movement_vec));

        // only add latest position if we've traveled far enough (trail is too short otherwise)
        if (new_pos[0] > this.rainbow_segment_coords[this.config.RAINBOW_SEGMENTS - 2][0] + 0.1) {
            this.rainbow_segment_coords.shift();
            this.rainbow_segment_coords.push(new_pos);
        } else {
            this.rainbow_segment_coords[this.config.RAINBOW_SEGMENTS - 1] = new_pos;
        }

        if (this.state === GameState.Playing) {
            this.shapes.rainbow_trail.update_segment_coords(this.rainbow_segment_coords);
            this.shapes.rainbow_trail.draw(context, program_state, Mat4.translation(-0.5, 0, -0.1), this.materials.rainbow);
            this.check_bounds(); //check if flappy cat went out of bounds
        }
    }

    display(context, program_state) {

         let t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
         this.config.SPEED = this.config.SPEED + .0005;
        if (this.state === GameState.Playing) {
            this.distance += (program_state.animation_delta_time / 1000) * this.config.SPEED;
            this.delta_distance = (program_state.animation_delta_time / 1000) * this.config.SPEED;
        }

        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }
        if(this.fpv == 1){
            program_state.set_camera(Mat4.translation(-10,-this.floppyobject_transform[1][3],15.85,1).times(Mat4.look_at(vec3(-20,0,0), vec3(0,0,0), vec3(0,1,0))));
        }
        else if(this.fpv == 0){
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const sun_position = vec4(20, 20, 15, -1); //hi
        const moon_position = vec4(10, 20, 100, -1);
        // The parameters of the Light are: position, color, size

        //change lights gradually throughout dark
        //sun
       program_state.lights = [new Light(sun_position, color(0.5*Math.cos(2*Math.PI/45*t%45), 0.5*Math.cos(2*Math.PI/45*t%45), 0.5*Math.cos(2*Math.PI/45*t%45)), 1000)];
       new Light(moon_position, color(-0.5*Math.cos(2*Math.PI/45*t%45), -0.5*Math.cos(2*Math.PI/45*t%45), -0.5*Math.cos(2*Math.PI/45*t%45)), 10);

        /*if (this.time_of_day == 0)
            program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];
        else
            program_state.lights = [new Light(light_position, color(.56, .51, .67, 1), -100)]*/

        const new_score = Math.floor(this.distance / this.config.PIPE_SEPARATION_X);
        if (new_score != this.score && this.state === GameState.Playing) {
            this.score = new_score;
            this.sounds.point.play();
        }

        let background_transform = Mat4.identity().times(Mat4.translation(0, 10, -80.0))
                                                  .times(Mat4.scale(80, 38, 1));
        this.shapes.square.draw(context, program_state, background_transform, this.materials.changing_background);
        // this.draw_axes(context, program_state); // TODO: remove this after we finish placing objects in scene
        this.draw_sky(context, program_state);
        this.draw_floppyobject(context, program_state);
        const out_of_bounds = this.check_bounds();
        const did_collide = this.draw_pipes_and_check_collision(context, program_state);
        this.draw_city(context, program_state);
        this.draw_score(context, program_state);

        if (this.state === GameState.Reset) {
            this.draw_start_screen(context, program_state);
            this.config.SPEED = 2.0;
        }

        if (out_of_bounds || did_collide) {
            //play sound
            this.sounds.fall.play();
            this.set_state(GameState.Reset);
        }
    }
}

class Changing_Background extends Textured_Phong {
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            void main(){

                float t = animation_time;
                vec4 normalized_coords = vec4(f_tex_coord.x, f_tex_coord.y, 0.0, 1.0);
                vec4 normalized_newtex_coord = normalized_coords;
                vec2 newtex_coord = vec2(normalized_newtex_coord.x, normalized_newtex_coord.y);

                vec4 tex_color = texture2D( texture, newtex_coord);
                if( tex_color.w < .01 ) discard;
                                                                     // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w );
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );


                float length_of_day = 45.0;
                float length_of_timeblock = length_of_day/4.0;

                float T = mod(t, length_of_day);

                vec3 firstColor = vec3(1.0, 1.0, 1.0);
                vec3 middleColor = vec3(1.0, 1.0, 1.0);
                vec3 endColor = vec3(1.0, 1.0, 1.0);

                if(T <= length_of_timeblock){
                firstColor = vec3(.6 + .4824/length_of_timeblock*T, .88 - .2/length_of_timeblock*T, 1.009 - .782/length_of_timeblock*T);
                middleColor = vec3(.6 + .2824/length_of_timeblock*T, .88 - .427/length_of_timeblock*T, 1.009 - .329/length_of_timeblock*T);
                endColor = vec3(.6 - .2/length_of_timeblock*T, 0.88 - .78/length_of_timeblock*T, 1.009 - .409/length_of_timeblock*T);
                }

                if(T > length_of_day/4.0  && T <= length_of_day/2.0){
                float a = T-length_of_timeblock;
                float b = a/length_of_timeblock;
                firstColor = vec3(1.0824 - 0.706*b, 0.68 - .511*b, 0.227 + .488*b);
                middleColor = vec3(0.8824 - 0.816*b, 0.453 -.333*b, 0.68 - .23*b);
                endColor = vec3(0.4 - 0.356*b, 0.1 - 0.0608*b, 0.6 - .35*b);
                }

                if(T > length_of_day/2.0 && T <= 3.0*length_of_day/4.0){
                float a = T-2.0*length_of_timeblock;
                float b = a/length_of_timeblock;
                firstColor = vec3(0.376 + 0.444*b, 0.169 + 0.4*b, 0.715 - .452*b);
                middleColor = vec3(0.0664 + 0.843*b, 0.12 + 0.758*b, 0.45 + 0.287*b);
                endColor = vec3(0.044 + 0.606*b, 0.0319 + 0.858*b, 0.25+.711*b);
                }

                if(T > 3.0*length_of_day/4.0 && T <= length_of_day){
                float a = T-3.0*length_of_timeblock;
                float b = a/length_of_timeblock;
                firstColor = vec3(0.82 - 0.22*b, 0.569 + 0.311*b, 0.263 + .746*b);
                middleColor = vec3(0.91 - 0.31*b, 0.878 + 0.002*b, 0.737 + 0.272*b);
                endColor = vec3(0.65 - 0.05*b, 0.8899 - 0.01*b, 0.96 - 0.049*b);
                }


                float h = 0.5; // adjust position of middleColor
                vec3 col = mix(mix(firstColor, middleColor, newtex_coord.y/h), mix(middleColor, endColor, (newtex_coord.y - h)/(1.0 - h)), step(h, newtex_coord.y));
                gl_FragColor = vec4(col, 1.0);


        } `;
    }
}
