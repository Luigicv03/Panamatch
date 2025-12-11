import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Crear intereses predeterminados
  const interests = [
    'Música',
    'Comida venezolana',
    'Arepas',
    'Deporte',
    'Rumba',
    'Playa',
    'Videojuegos',
    'Fútbol',
    'Béisbol',
    'Salsa',
    'Reggaeton',
    'Café',
    'Viajar',
    'Cine',
    'Leer',
    'Baile',
    'Cocinar',
    'Arte',
    'Fotografía',
  ];

  console.log('📝 Creando intereses...');
  for (const interestName of interests) {
    await prisma.interest.upsert({
      where: { name: interestName },
      update: {},
      create: {
        name: interestName,
      },
    });
  }

  console.log(`✅ ${interests.length} intereses creados`);

  console.log('✨ Seed completado!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

