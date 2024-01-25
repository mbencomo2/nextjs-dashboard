import { ObjectId } from 'mongodb';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
  Invoice,
  Customer,
} from './definitions';
import clientPromise from './mongodb';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';

export async function fetchRevenue() {
  // Add noStore() here to prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();

  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('revenue');
    const result = await collection.find({}).toArray();

    return result;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    const result = await collection.aggregate([
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id',
          foreignField: 'id',
          as: 'customer',
        },
      },
      {
        $unwind: '$customer',
      },
      {
        $project: {
          amount: '$amount',
          name: '$customer.name',
          image_url: '$customer.image_url',
          email: '$customer.email',
          id: '$_id',
        },
      },
      {
        $sort: {
          date: -1,
        },
      },
      {
        $limit: 5,
      },
    ]);
    const data = await result.toArray();

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const invoices = db.collection('invoices');
    const customers = db.collection('customers');

    const invoiceCountPromise = invoices.countDocuments({});
    const customerCountPromise = customers.countDocuments({});
    const invoiceStatusPromise = invoices
      .aggregate([
        {
          $group: {
            _id: null,
            paid: {
              $sum: {
                $cond: {
                  if: { $eq: ['$status', 'paid'] },
                  then: '$amount',
                  else: 0,
                },
              },
            },
            pending: {
              $sum: {
                $cond: {
                  if: { $eq: ['$status', 'pending'] },
                  then: '$amount',
                  else: 0,
                },
              },
            },
          },
        },
      ])
      .toArray();

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0] ?? '0');
    const numberOfCustomers = Number(data[1] ?? '0');
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    const result = collection
      .aggregate([
        {
          $lookup: {
            from: 'customers',
            localField: 'customer_id',
            foreignField: 'id',
            as: 'customer',
          },
        },
        {
          $unwind: '$customer',
        },
        {
          $match: {
            $or: [
              { 'customer.name': { $regex: new RegExp(query, 'i') } },
              { 'customer.email': { $regex: new RegExp(query, 'i') } },
              { amount: { $regex: new RegExp(query, 'i') } },
              { date: { $regex: new RegExp(query, 'i') } },
              { status: { $regex: new RegExp(query, 'i') } },
            ],
          },
        },
        {
          $project: {
            id: '$id',
            amount: '$amount',
            date: '$date',
            status: '$status',
            name: '$customer.name',
            email: '$customer.email',
            image_url: '$customer.image_url',
          },
        },
        {
          $sort: {
            date: -1,
          },
        },
        {
          $skip: offset,
        },
        {
          $limit: ITEMS_PER_PAGE,
        },
      ])
      .toArray();

    return result;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    const result = await collection
      .aggregate([
        {
          $lookup: {
            from: 'customers',
            localField: 'customer_id',
            foreignField: 'id',
            as: 'customer',
          },
        },
        {
          $unwind: '$customer',
        },
        {
          $match: {
            $or: [
              { 'customer.name': { $regex: new RegExp(query, 'i') } },
              { 'customer.email': { $regex: new RegExp(query, 'i') } },
              { amount: { $regex: new RegExp(query, 'i') } },
              { date: { $regex: new RegExp(query, 'i') } },
              { status: { $regex: new RegExp(query, 'i') } },
            ],
          },
        },
        {
          $count: 'total',
        },
      ])
      .toArray();

    const totalPages = Math.ceil(Number(result[0].total) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();
  const invoiceId = new ObjectId(id);
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    const result = await collection
      .aggregate([
        {
          $match: {
            _id: invoiceId,
          },
        },
        {
          $project: {
            id: '$id',
            customer_id: '$customer_id',
            amount: '$amount',
            status: '$status',
          },
        },
      ])
      .toArray();

    const invoice = result.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    if (!invoice) {
      notFound();
    }

    return invoice[0] as Invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  noStore();
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('customers');
    const result = await collection
      .aggregate([
        {
          $project: {
            id: '$id',
            name: '$name',
          },
        },
        {
          $sort: {
            name: 1,
          },
        },
      ])
      .toArray();

    const customers = result.map((customer) => {
      return {
        id: `${customer.id}`,
        name: customer.name
      }
    });

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  noStore();
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('customers');
    const result = await collection
      .aggregate([
        {
          $lookup: {
            from: 'invoices',
            localField: 'id',
            foreignField: 'customer_id',
            as: 'invoices',
          },
        },
        {
          $match: {
            $or: [
              { name: { $regex: new RegExp(query, 'i') } },
              { email: { $regex: new RegExp(query, 'i') } },
            ],
          },
        },
        {
          $group: {
            _id: {
              id: '$id',
              name: '$name',
              email: '$email',
              image_url: '$image_url',
            },
            total_invoices: { $sum: 1 },
            total_pending: {
              $sum: {
                $cond: {
                  if: { $eq: ['$invoices.status', 'pending'] },
                  then: '$invoices.amount',
                  else: 0,
                },
              },
            },
            total_paid: {
              $sum: {
                $cond: {
                  if: { $eq: ['$invoices.status', 'paid'] },
                  then: '$invoices.amount',
                  else: 0,
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            id: '$_id.id',
            name: '$_id.name',
            email: '$_id.email',
            image_url: '$_id.image_url',
            total_invoices: '$total_invoices',
            total_pending: '$total_pending',
            total_paid: '$total_paid',
          },
        },
        {
          $sort: {
            name: 1,
          },
        },
      ])
      .toArray();

    const customers = result.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
  noStore();
  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('users');
    const result = await collection.find({ email: email }).toArray();
    return result[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
