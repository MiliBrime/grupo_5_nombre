authMiddleware.js

function authMiddleware(req,res,next){
  if (!req.session.userLogged) //no tengo a nadie en sesion
  {
    return res.redirect("/users/login")
  }
  next(); 
  }

module.exports = authMiddleware;


 //router.get (“/profile”, authMiddleware, usersController.profile);