const express = require("express");
const {validationResult} = require ("express-validator");
const fs=require("fs");
const path = require("path");
const bcryptjs = require('bcryptjs')
const users= require("../models/users");
const db = require("../../database/models");

const { Op } = require('sequelize');

/* const { use } = require("../routes/usersRouter");
 */
// Leer el archivo JSON de los administradores
const adminsData = fs.readFileSync('src/data/admins.json');
const admins = JSON.parse(adminsData).admins;

let usersController={
    login:(req,res)=>{
        res.render("login");
    },
    processLogin: async (req, res) => {
        try{
            let userToLogin = await users.findByField("email", req.body.email);
            if(userToLogin) {
                let isThePasswordOk = bcryptjs.compareSync (req.body.password, userToLogin.password);
                if (isThePasswordOk) {
                    delete userToLogin.password; //por seguridad

                    if(req.body.rememberUser == "recordame") {
                        res.cookie("recordame", userToLogin.dataValues, {maxAge: 365 * 24 * 60 * 60 * 1000}) 
                    }
                    if(admins.includes(userToLogin.email)){
                            req.session.admin = userToLogin.dataValues;
                            console.log("es admin ;)")  
                    }                    
                    else {
                        req.session.userLogged = userToLogin.dataValues; 
                    }
                    return res.redirect("/users/profile") 
                }

                return res.render("login", {
                    errors: {
                        password: {
                             msg: 'Los datos ingresados son incorrectos. Vuelva a intentarlo.'
                            }
                        }
                    });
        }     
        return res.render("login", {
            errors: {
                email: {
                    msg: 'El correo electrónico ingresado no está registrado. Vuelva a intentarlo.'
                }
            }
        });
    } catch (error){
        console.log("Error: ", error);
        res.status(500).send('Error interno del servidor');
    }               
    },

    logout:(req,res)=>{
        res.clearCookie("recordame");
        req.session.destroy (); //borra todo lo que esté en session
        res.redirect ("/"); 
    },
    
    register:(req,res)=>{
        res.render("register");
    },

    processRegister: async (req,res)=>{
        try{
        const errores= validationResult(req);
        const old= req.body;
        if (!errores.isEmpty()) {
            if (req.file) {
                const imagePath = path.join(__dirname, '../../public/img/users', req.file.filename);
                fs.unlinkSync(imagePath);
            }
            return res.render("register", { mensajesDeError: errores.mapped(), old });
        } 
        else {
            const newUser = await users.processCreate(req, res);

            //verificar si el mail está en la lista de admins
            if (admins.includes(newUser.email)) {
               //asignar el rol de admin
               let adminRole = await db.Role.findOne({
                where: {type: "admin"}
               });
               if (adminRole) {
               await db.User_role.create({
                user_id: newUser.id,
                role_id: adminRole.id
               });}
               req.session.admin= newUser;
               console.log("Usuario registrado como administrador ;)"); 
               
            } else{
                let userRole = await db.Role.findOne({
                    where: {type: "user"}
                   });
                   if (userRole){
                   await db.User_role.create({
                    user_id: newUser.id,
                    role_id: userRole.id
                   });}
                   req.session.userLogged = newUser;
                   console.log("Usuario registrado como normal ;)");
                
            }
                return res.redirect("/users/profile") 
            }
        } catch (error){
                console.log('Error:', error);
                return res.status(500).send('Error interno del servidor');
                }
        }, 

    profile: async (req,res)=>{
        let user = req.session.userLogged;
        let admin = req.session.admin;
        if (user) {
        let address= await db.Address.findOne({
            where: {
                user_id: user.id
            }
        })
        res.render("profile", {user, address})
    } if (admin){
        res.redirect("/products")
    }
    },

    editProfile: async (req, res) => {
        try {
            await users.edit(req, res);
        } catch (error) {
            console.error(error); // Registra el error completo en la consola
            return res.status(500).send("Error al editar el perfil: " + error.message); // Devuelve un mensaje de error más detallado
        }
    },

    list: async (req, res) => {
		try { 
            const usersList = await db.User.findAll({ include: [{ model: db.Address, as: 'addresses' },   { model: db.Role, as: 'roles' }] });
            res.render("usersList", {usersList});
		
	} catch (error) {
		console.error('Error:', error);
		res.status(500).send('Error interno del servidor');
	}
	},

    editFromAdmin: async(req,res)=>{
        try{
            let userId = req.params.id;
            const userToUpdate = await db.User.findByPk(userId);
            const userAddress = await db.Address.findOne({ where: { user_id: userId } });
            res.render("usersEdit", { user: userToUpdate, address: userAddress });
        }catch(error){
            console.log('Error:', error);
        }
    },

    updateFromAdmin:async (req,res)=>{
        try {
            await users.updateFromAdmin(req, res);
        } catch (error) {
            console.log(error);
            res.render("error", { message: "Error al actualizar usuario" });
        }
    }, 

    delete: async (req, res) => {
		try { 
            // Buscar y eliminar todas las direcciones asociadas al usuario
            await db.Address.destroy({
                where: {
                    user_id: req.params.id
                }
            });

            // Buscar y eliminar todas las relaciones de usuario en la tabla user_role
            await db.User_role.destroy({
                where: {
                    user_id: req.params.id
                }
            });

            // Luego eliminar al usuario
            await db.User.destroy({
                where: {
                    id: req.params.id
                }
            });
            res.redirect("/users/list");

        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Error interno del servidor');    
        }
	},

    search:async(req,res)=>{
        try{
        let keyword= req.body.keyword
        let usersFound = await db.User.findAll({
            include: [{ model: db.Address, as: 'addresses' },   { model: db.Role, as: 'roles' }],
			where: {
				last_name: {[Op.like]: "%" + keyword + "%"}
			}
		})
        return res.render("searchUser",{usersFound, keyword});
		}
		catch (error){
			console.error('Error:', error);
			res.status(500).send('Error interno del servidor');	
		}
    }
}


module.exports=usersController;