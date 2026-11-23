export const educationServices = {
  editorial: {
    path: "/produccion-editorial",
    program: "Producción editorial",
    title: "Producción editorial de materiales educativos en Colombia",
    description: "Alesya Ediciones desarrolla materiales educativos para colegios e instituciones. Consulta el alcance de un proyecto editorial según el público y el formato.",
    audience: "Para colegios, organizaciones y equipos que necesitan preparar material educativo propio.",
    items: [
      { title: "Contenido educativo", text: "Cuéntanos qué material necesita la institución, para qué público y qué contenidos tiene preparados." },
      { title: "Producción editorial", text: "Consulta por redacción, corrección, diseño o ilustración según el estado del material y el objetivo de la publicación." },
      { title: "Alcance de la cotización", text: "Las etapas, los entregables, el formato, el precio y los plazos se acuerdan para cada proyecto." },
    ],
    brief: "Indica el tipo de publicación, los grados o el público, qué materiales ya tienes y cuándo los necesitas.",
    related: { path: "/plan-lector#plan-lector-30-estudiantes", label: "Consultar libros de Alesya por grado" },
  },
  preicfes: {
    path: "/preicfes",
    program: "Preicfes",
    title: "Preicfes para colegios en Colombia",
    description: "Consulta con Alesya Ediciones una propuesta institucional de preparación para la prueba Saber 11 del ICFES.",
    audience: "Para colegios que preparan a sus estudiantes para la prueba Saber 11.",
    items: [
      { title: "Preparación para Saber 11", text: "Solicita una propuesta institucional de preparación para la prueba y comparte las necesidades del grupo." },
      { title: "Contexto del colegio", text: "Cuéntanos cuántos estudiantes participarían, en qué municipio se encuentra la institución y cuál es su calendario." },
      { title: "Alcance de la cotización", text: "La modalidad, las fechas, la duración, los materiales y el precio se confirman al cotizar." },
    ],
    brief: "Indica el colegio, municipio, número aproximado de estudiantes y periodo en el que necesitan la preparación.",
    related: { path: "/#servicios", label: "Ver otros servicios para instituciones educativas" },
  },
  training: {
    path: "/formacion-docente",
    program: "Formación docente",
    title: "Formación docente en robótica educativa y STEAM",
    description: "Consulta formación para docentes de colegios en Colombia con Alesya X-Tech. Prepara a tu equipo para trabajar con proyectos de robótica y cultura maker.",
    audience: "Para equipos docentes y coordinadores que quieren llevar proyectos de robótica educativa o cultura maker al aula.",
    items: [
      { title: "Proyectos para el aula", text: "Consulta formación para trabajar con retos de construcción y programación acordes con los grados e intereses del colegio." },
      { title: "Recursos existentes", text: "Comparte el nivel de experiencia del equipo y los kits o materiales que ya tiene la institución." },
      { title: "Alcance de la cotización", text: "Los temas, la modalidad, las horas, el número de participantes, los recursos y el precio se confirman al cotizar." },
    ],
    brief: "Indica cuántos docentes participarían, qué grados acompañan, qué equipos tienen y qué esperan llevar al aula.",
    related: { path: "/colegios", label: "Ver el programa de robótica para colegios" },
  },
};

export const serviceDirectory = [
  { title: "Plan lector", path: "/plan-lector#plan-lector-30-estudiantes", description: "Literatura y libros escolares por grado, con ISBN y cotización para grupos." },
  { title: "Producción editorial", path: educationServices.editorial.path, description: "Desarrollo de materiales educativos según el público y el alcance de la obra." },
  { title: "Robótica para colegios", path: "/colegios", description: "Programas con kits, proyectos de aula, formación y acompañamiento." },
  { title: "Tienda educativa", path: "/catalogo", description: "Kits, Arduino, sensores, impresión 3D, bricolaje y libros." },
  { title: "Preicfes", path: educationServices.preicfes.path, description: "Preparación institucional para la prueba Saber 11." },
  { title: "Formación docente", path: educationServices.training.path, description: "Capacitación en robótica educativa y cultura maker para equipos docentes." },
];
