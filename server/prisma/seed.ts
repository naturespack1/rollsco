import { PrismaClient, AdminRole, FoodType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean up in correct order
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminStore.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.store.deleteMany();

  // Create Stores
  const store1 = await prisma.store.create({
    data: {
      name: "Roll's & Co. Boring Road",
      address: 'Boring Road, Patna',
      isOpen: true,
      acceptingOrders: true
    }
  });

  const store2 = await prisma.store.create({
    data: {
      name: "Roll's & Co. Kankarbagh",
      address: 'Kankarbagh, Patna',
      isOpen: true,
      acceptingOrders: true
    }
  });

  // Create Super Admin
  const admin = await prisma.adminUser.create({
    data: {
      email: 'admin@rollsandco.com',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: AdminRole.SUPER_ADMIN
    }
  });

  // Link admin to both stores
  await prisma.adminStore.create({
    data: { adminId: admin.id, storeId: store1.id }
  });
  await prisma.adminStore.create({
    data: { adminId: admin.id, storeId: store2.id }
  });

  // Create Categories
  const catRoll = await prisma.category.create({ data: { name: 'Rolls', sort: 1 } });
  const catBurger = await prisma.category.create({ data: { name: 'Burgers', sort: 2 } });
  const catExtra = await prisma.category.create({ data: { name: 'Extras', sort: 3 } });
  const catCombo = await prisma.category.create({ data: { name: 'Combos', sort: 4 } });
  const catBev = await prisma.category.create({ data: { name: 'Beverages', sort: 5 } });

  // Items data (new list)
  const itemsData = [
    // Rolls
    {
      storeId: store1.id,
      categoryId: catRoll.id,
      name: 'Crispy Chicken Roll',
      description: 'Crispy fried chicken wrapped in a soft rumali roti with onions and sauce.',
      price: 100,
      stock: 25,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/rolls1.jpg',
      isBestseller: true
    },
    {
      storeId: store1.id,
      categoryId: catRoll.id,
      name: 'Chicken Tikka Roll',
      description: 'Spicy chicken tikka with onions and mint chutney in a rumali roti.',
      price: 100,
      stock: 20,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/rolls2.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catRoll.id,
      name: 'Paneer Tikka Roll',
      description: 'Grilled paneer tikka with capsicum and onions in a whole wheat wrap.',
      price: 100,
      stock: 18,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/rolls3.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catRoll.id,
      name: 'Falafel Roll',
      description: 'Crispy falafel with fresh vegetables and tahini sauce.',
      price: 80,
      stock: 22,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/rolls4.jpg'
    },

    // Burgers
    {
      storeId: store1.id,
      categoryId: catBurger.id,
      name: 'Crispy Chicken Burger',
      description: 'Crispy chicken patty with lettuce, tomato and special sauce.',
      price: 80,
      stock: 25,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/burgers1.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catBurger.id,
      name: 'Veg Falafel Burger',
      description: 'Crispy falafel patty with fresh veggies and sauce.',
      price: 70,
      stock: 20,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/burgers2.jpg'
    },

    // Extras
    {
      storeId: store1.id,
      categoryId: catExtra.id,
      name: 'Chicken Popcorn',
      description: 'Crispy bite-sized chicken pieces.',
      price: 80,
      stock: 30,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/extras1.jpg',
      isBestseller: true
    },
    {
      storeId: store1.id,
      categoryId: catExtra.id,
      name: 'Falafel Box',
      description: 'Crispy falafel served with dip.',
      price: 70,
      stock: 25,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/extras2.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catExtra.id,
      name: 'Classic Fries',
      description: 'Golden crispy french fries.',
      price: 40,
      stock: 40,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/extras3.jpg',
      isBestseller: true
    },
    {
      storeId: store1.id,
      categoryId: catExtra.id,
      name: 'Peri Peri Fries',
      description: 'Spicy peri-peri seasoned french fries.',
      price: 40,
      stock: 35,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/extras4.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catExtra.id,
      name: 'Cheese',
      description: 'Extra cheese slice.',
      price: 10,
      stock: 50,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/extras5.jpg'
    },

    // Combos
    {
      storeId: store1.id,
      categoryId: catCombo.id,
      name: 'Executive Combo',
      description: 'Your choice of roll + fries + beverage.',
      price: 160,
      stock: 20,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/combos1.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catCombo.id,
      name: 'Magic Combo',
      description: 'Your choice of falafal roll + fries + beverage.',
      price: 140,
      stock: 18,
      gstRate: 5,
      hsnCode: '2106',
      imageUrl: '/images/combos2.jpg'
    },

    // Beverages
    {
      storeId: store1.id,
      categoryId: catBev.id,
      name: 'Classic Cold Coffee',
      description: 'Creamy cold coffee with whipped cream.',
      price: 60,
      stock: 35,
      gstRate: 12,
      hsnCode: '2202',
      imageUrl: '/images/beverages1.jpg',
      isBestseller: true
    },
    {
      storeId: store1.id,
      categoryId: catBev.id,
      name: 'Iced Lemon Tea',
      description: 'Refreshing iced lemon tea.',
      price: 40,
      stock: 40,
      gstRate: 12,
      hsnCode: '2202',
      imageUrl: '/images/beverages2.jpg'
    },
    {
      storeId: store1.id,
      categoryId: catBev.id,
      name: 'Water 500ml',
      description: 'Bottled drinking water.',
      price: 10,
      stock: 60,
      gstRate: 12,
      hsnCode: '2201',
      imageUrl: '/images/beverages3.jpg'
    }
  ];

  // Executive Combo intentionally has no symbol because it can contain either choice.
  const foodTypes: Record<string, FoodType> = {
    'Crispy Chicken Roll': FoodType.NON_VEG,
    'Chicken Tikka Roll': FoodType.NON_VEG,
    'Paneer Tikka Roll': FoodType.VEG,
    'Falafel Roll': FoodType.VEG,
    'Crispy Chicken Burger': FoodType.NON_VEG,
    'Veg Falafel Burger': FoodType.VEG,
    'Chicken Popcorn': FoodType.NON_VEG,
    'Falafel Box': FoodType.VEG,
    'Classic Fries': FoodType.VEG,
    'Peri Peri Fries': FoodType.VEG,
    'Cheese': FoodType.VEG,
    'Magic Combo': FoodType.VEG,
    'Classic Cold Coffee': FoodType.VEG,
    'Iced Lemon Tea': FoodType.VEG,
    'Water 500ml': FoodType.VEG,
  };

  // Seed items for Store 1
  for (const item of itemsData) {
    await prisma.item.create({ data: { ...item, foodType: foodTypes[item.name] ?? null } });
  }

  // Replicate items for Store 2
  for (const item of itemsData) {
    const { id, ...itemData } = item as any;
    await prisma.item.create({
      data: { ...itemData, foodType: foodTypes[item.name] ?? null, storeId: store2.id }
    });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
